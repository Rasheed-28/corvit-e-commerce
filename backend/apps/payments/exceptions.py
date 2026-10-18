class PaymentError(Exception):
    """Base exception for payment domain errors."""
    def __init__(self, message: str, code: str = 'PAYMENT_ERROR', details: dict = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class PaymentConfigurationError(PaymentError):
    """Raised when a payment provider adapter is called without mandatory credentials or settings."""
    def __init__(self, message: str, unconfigured_keys: list = None):
        super().__init__(
            message=message,
            code='PAYMENT_CONFIGURATION_ERROR',
            details={'unconfigured_keys': unconfigured_keys or []}
        )


class DuplicatePaymentError(PaymentError):
    """Raised when an attempt is made to charge an already paid, processing, or cancelled order."""
    def __init__(self, message: str, order_number: str = ''):
        super().__init__(
            message=message,
            code='DUPLICATE_PAYMENT_ERROR',
            details={'order_number': order_number}
        )


class WebhookSignatureVerificationError(PaymentError):
    """Raised when incoming webhook signature does not match or is malformed."""
    def __init__(self, message: str = 'Webhook signature verification failed'):
        super().__init__(
            message=message,
            code='INVALID_WEBHOOK_SIGNATURE'
        )


class InvalidOrderStateError(PaymentError):
    """Raised when attempting payment actions on orders in terminal or invalid states."""
    def __init__(self, message: str, current_status: str = '', order_number: str = ''):
        super().__init__(
            message=message,
            code='INVALID_ORDER_STATE',
            details={'current_status': current_status, 'order_number': order_number}
        )


class ExcessiveRefundError(PaymentError):
    """Raised when attempting to refund an amount greater than the captured charge."""
    def __init__(self, message: str, max_allowed: str = ''):
        super().__init__(
            message=message,
            code='EXCESSIVE_REFUND',
            details={'max_allowed': max_allowed}
        )
