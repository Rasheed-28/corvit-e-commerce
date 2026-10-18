from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from apps.orders.models import Order, Payment
from .services import PaymentService
from .adapters.factory import get_payment_adapter, list_available_adapters
from .exceptions import (
    PaymentError,
    PaymentConfigurationError,
    DuplicatePaymentError,
    InvalidOrderStateError,
    ExcessiveRefundError,
    WebhookSignatureVerificationError,
)
from .serializers import (
    PaymentIntentCreateSerializer,
    PaymentConfirmSerializer,
    PaymentRefundSerializer,
    PaymentAuditSerializer,
)
from .utils.logger import payment_logger


class PaymentConfigView(APIView):
    """
    Returns public payment gateway configuration and readiness status.
    Clearly identifies which provider is active, supported countries, currencies,
    payment methods, and what keys remain unconfigured.
    Never exposes backend secrets or private keys.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        active_adapter = get_payment_adapter()
        all_adapters_status = list_available_adapters()

        return Response({
            'success': True,
            'data': {
                'active_gateway': active_adapter.gateway_name,
                'is_active_gateway_configured': active_adapter.is_configured,
                'active_gateway_status': active_adapter.get_configuration_status(),
                'available_gateways': all_adapters_status,
                'safe_public_credentials': {
                    'stripe_publishable_key': getattr(active_adapter, 'publishable_key', '') if active_adapter.gateway_name == 'stripe' else '',
                },
            }
        })


class PaymentIntentCreateView(APIView):
    """
    Initializes a server-side payment intent/session linked to an Order.
    Protects against duplicate charges if the order is already paid.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PaymentIntentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order_number = serializer.validated_data['order_number']
        payment_method = serializer.validated_data['payment_method']
        gateway = serializer.validated_data.get('gateway')
        idempotency_key = serializer.validated_data.get('idempotency_key')

        if request.user.is_staff:
            order = get_object_or_404(Order, order_number=order_number)
        else:
            order = get_object_or_404(Order, order_number=order_number, user=request.user)

        try:
            intent_res, payment = PaymentService.create_payment_intent(
                order=order,
                payment_method=payment_method,
                gateway_name=gateway,
                idempotency_key=idempotency_key
            )

            if not intent_res.success:
                return Response({
                    'success': False,
                    'error': {
                        'code': intent_res.error_code or 'INTENT_CREATION_FAILED',
                        'message': intent_res.error_message or 'Failed to create payment intent.',
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'success': True,
                'message': 'Payment intent created successfully.',
                'data': {
                    'intent_id': intent_res.intent_id,
                    'client_secret': intent_res.client_secret,
                    'status': intent_res.status,
                    'amount': intent_res.amount,
                    'currency': intent_res.currency,
                    'gateway': payment.gateway,
                    'order_number': order.order_number,
                }
            }, status=status.HTTP_201_CREATED)

        except DuplicatePaymentError as exc:
            return Response({
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.message,
                    'details': exc.details
                }
            }, status=status.HTTP_409_CONFLICT)
        except (PaymentConfigurationError, InvalidOrderStateError) as exc:
            return Response({
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.message,
                    'details': exc.details
                }
            }, status=status.HTTP_400_BAD_REQUEST)


class PaymentConfirmView(APIView):
    """
    Confirms and server-side verifies a payment transaction.
    Rejects duplicate payments and locks order record during transition.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PaymentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = serializer.validated_data['order']
        # Permission check: customer can only confirm payments for their own orders
        if not request.user.is_staff and order.user != request.user:
            return Response({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'You do not have permission to pay for this order.',
                }
            }, status=status.HTTP_403_FORBIDDEN)

        transaction_id = serializer.validated_data.get('transaction_id')
        payment_token = serializer.validated_data.get('payment_token')
        payment_method = serializer.validated_data.get('payment_method', Payment.PaymentMethod.CREDIT_CARD)
        gateway = serializer.validated_data.get('gateway')
        simulate_failure = serializer.validated_data.get('simulate_failure', False)
        idempotency_key = serializer.validated_data.get('idempotency_key')

        options = {
            'simulate_failure': simulate_failure,
        }

        try:
            verification, payment = PaymentService.confirm_and_verify_payment(
                order=order,
                transaction_id=transaction_id,
                payment_token=payment_token,
                payment_method=payment_method,
                gateway_name=gateway,
                idempotency_key=idempotency_key,
                options=options
            )

            order.refresh_from_db()

            if not verification.success or payment.status == Payment.PaymentStatus.FAILED:
                return Response({
                    'success': False,
                    'error': {
                        'code': payment.error_code or 'PAYMENT_DECLINED',
                        'message': payment.error_message or 'Payment was declined by the provider.',
                        'payment': PaymentAuditSerializer(payment).data,
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'success': True,
                'message': 'Payment successfully verified and order confirmed.',
                'data': {
                    'order_number': order.order_number,
                    'order_status': order.status,
                    'payment': PaymentAuditSerializer(payment).data,
                }
            }, status=status.HTTP_200_OK)

        except DuplicatePaymentError as exc:
            return Response({
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.message,
                    'details': exc.details
                }
            }, status=status.HTTP_409_CONFLICT)
        except (PaymentConfigurationError, InvalidOrderStateError) as exc:
            return Response({
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.message,
                    'details': exc.details
                }
            }, status=status.HTTP_400_BAD_REQUEST)


class PaymentRefundView(APIView):
    """
    Staff/Admin endpoint to issue full or partial refunds.
    Never exceeds original payment amount; synchronizes order status upon full refund.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, transaction_id):
        payment = get_object_or_404(Payment, transaction_id=transaction_id)
        serializer = PaymentRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data.get('amount')
        reason = serializer.validated_data.get('reason', 'Customer requested refund')

        try:
            refund_res = PaymentService.process_refund(
                payment=payment,
                amount=amount,
                reason=reason
            )

            if not refund_res.success:
                return Response({
                    'success': False,
                    'error': {
                        'code': refund_res.error_code or 'REFUND_FAILED',
                        'message': refund_res.error_message or 'Refund processing failed.',
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            payment.refresh_from_db()
            return Response({
                'success': True,
                'message': f"Refund of ${refund_res.amount} successfully processed.",
                'data': {
                    'refund_id': refund_res.refund_id,
                    'refund_amount': refund_res.amount,
                    'payment': PaymentAuditSerializer(payment).data,
                    'order_status': payment.order.status,
                }
            }, status=status.HTTP_200_OK)

        except (InvalidOrderStateError, ExcessiveRefundError, PaymentConfigurationError) as exc:
            return Response({
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.message,
                    'details': getattr(exc, 'details', {})
                }
            }, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name='dispatch')
class PaymentWebhookView(APIView):
    """
    Public webhook receiver for payment gateways (Simulated, Stripe, etc.).
    - Validates cryptographic signature via HMAC-SHA256.
    - Rejects invalid signatures with HTTP 400.
    - Idempotently processes events via PaymentWebhookEvent table.
    - Safely transitions payment and order records without duplicate executions.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # Gateways do not send bearer tokens/cookies

    def post(self, request, provider):
        payload_bytes = request.body
        headers = {k: v for k, v in request.headers.items()}

        payment_logger.info(f"[WebhookReceiver] Incoming webhook for provider '{provider}'")

        try:
            result = PaymentService.process_webhook_event(
                provider_name=provider,
                payload_bytes=payload_bytes,
                headers=headers
            )
            return Response({
                'success': True,
                'message': 'Webhook received and processed.',
                'data': result
            }, status=status.HTTP_200_OK)

        except WebhookSignatureVerificationError as exc:
            payment_logger.warning(f"[WebhookReceiver] Rejected signature for provider '{provider}': {exc.message}")
            return Response({
                'success': False,
                'error': {
                    'code': exc.code,
                    'message': exc.message
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            payment_logger.error(f"[WebhookReceiver] Unexpected error processing webhook: {exc}")
            return Response({
                'success': False,
                'error': {
                    'code': 'WEBHOOK_PROCESSING_ERROR',
                    'message': str(exc)
                }
            }, status=status.HTTP_400_BAD_REQUEST)
