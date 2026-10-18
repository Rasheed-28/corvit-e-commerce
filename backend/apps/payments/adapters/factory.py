from typing import Dict, List, Optional
from django.conf import settings
from .base import BasePaymentAdapter
from .simulated import SimulatedPaymentAdapter
from .stripe_adapter import StripePaymentAdapter
from ..utils.logger import payment_logger

ADAPTER_REGISTRY: Dict[str, type] = {
    'simulated': SimulatedPaymentAdapter,
    'stripe': StripePaymentAdapter,
}

_ADAPTER_INSTANCES: Dict[str, BasePaymentAdapter] = {}


def get_payment_adapter(
    gateway_name: Optional[str] = None,
    fresh: bool = False
) -> BasePaymentAdapter:
    """
    Factory resolving payment adapter based on parameter, settings.PAYMENT_GATEWAY,
    or safe local default ('simulated').
    """
    target = (
        gateway_name or
        getattr(settings, 'PAYMENT_GATEWAY', 'simulated') or
        'simulated'
    ).lower().strip()

    adapter_cls = ADAPTER_REGISTRY.get(target)
    if not adapter_cls:
        payment_logger.warning(
            f"[PaymentFactory] Gateway '{target}' not recognized. Falling back to 'simulated'."
        )
        adapter_cls = SimulatedPaymentAdapter
        target = 'simulated'

    if fresh or target not in _ADAPTER_INSTANCES:
        _ADAPTER_INSTANCES[target] = adapter_cls()

    return _ADAPTER_INSTANCES[target]


def list_available_adapters() -> List[Dict[str, any]]:
    """Returns configuration status and capabilities of all registered adapters."""
    results = []
    for name, adapter_cls in ADAPTER_REGISTRY.items():
        adapter = adapter_cls()
        results.append(adapter.get_configuration_status())
    return results
