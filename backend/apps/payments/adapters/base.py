from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, Optional


@dataclass
class PaymentIntentResult:
    """Standardized result returned when a payment intent/session is initialized."""
    success: bool
    intent_id: str
    client_secret: str
    status: str
    amount: Decimal
    currency: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class PaymentVerificationResult:
    """Standardized result returned when a payment is verified server-side with gateway."""
    success: bool
    transaction_id: str
    status: str  # PENDING, SUCCESSFUL, FAILED, CANCELLED, REFUNDED
    amount: Decimal
    currency: str
    gateway_name: str
    card_brand: str = 'Card'
    card_last4: str = '4242'
    raw_response: Dict[str, Any] = field(default_factory=dict)
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class RefundResult:
    """Standardized result returned when a refund is processed via the gateway."""
    success: bool
    refund_id: str
    status: str  # 'succeeded', 'pending', 'failed'
    amount: Decimal
    currency: str
    raw_response: Dict[str, Any] = field(default_factory=dict)
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class NormalizedWebhookEvent:
    """Normalized webhook event payload across all providers."""
    event_id: str
    event_type: str  # e.g. payment.succeeded, payment.failed, payment.cancelled, payment.refunded
    transaction_id: str
    order_number: Optional[str]
    status: str  # PENDING, SUCCESSFUL, FAILED, CANCELLED, REFUNDED
    amount: Optional[Decimal]
    currency: Optional[str]
    raw_data: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class BasePaymentAdapter(ABC):
    """
    Abstract Base Class for all Payment Gateway Adapters.
    Defines the standard interface for creating payment intents, verifying transactions
    server-side, processing refunds, validating webhook signatures, and normalising events.
    """
    gateway_name: str = 'base'

    @abstractmethod
    def get_configuration_status(self) -> Dict[str, Any]:
        """
        Returns structured diagnostic details of provider configuration:
        whether keys are configured, what remains unconfigured, supported countries,
        currencies, and payment methods. Never exposes secret keys.
        """
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if all required credentials for this provider are configured."""
        pass

    @abstractmethod
    def create_payment_intent(
        self,
        order,
        payment_method: str = 'CREDIT_CARD',
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentIntentResult:
        """Initializes a server-side payment intent or checkout session."""
        pass

    @abstractmethod
    def confirm_payment(
        self,
        transaction_id: str,
        payment_token: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> PaymentVerificationResult:
        """Confirms and captures payment with the payment gateway."""
        pass

    @abstractmethod
    def verify_payment(self, transaction_id: str) -> PaymentVerificationResult:
        """
        Direct server-to-server query to the gateway verifying the true status of a charge.
        Prevents client tampering.
        """
        pass

    @abstractmethod
    def process_refund(
        self,
        payment,
        amount: Optional[Decimal] = None,
        reason: str = ''
    ) -> RefundResult:
        """Processes a full or partial refund with the gateway."""
        pass

    @abstractmethod
    def verify_webhook_signature(
        self,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> bool:
        """
        Cryptographically validates that the incoming webhook originated
        from the payment gateway and has not been forged or tampered with.
        """
        pass

    @abstractmethod
    def parse_webhook_event(
        self,
        payload_bytes: bytes,
        headers: Dict[str, str]
    ) -> NormalizedWebhookEvent:
        """Parses and normalizes provider-specific webhook into NormalizedWebhookEvent."""
        pass
