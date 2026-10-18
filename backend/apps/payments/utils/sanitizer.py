import re
import copy
from typing import Any, Dict, Union

# Regex pattern matching 13-19 digit card numbers (allowing spaces or hyphens)
PAN_REGEX = re.compile(r'\b(?:\d[ -]*?){13,19}\b')

# Sensitive keys that must be strictly redacted in dictionaries and log records
SENSITIVE_KEYS = {
    'card_number', 'cardnumber', 'pan', 'primary_account_number',
    'cvv', 'cvc', 'cvv2', 'security_code', 'card_code',
    'secret', 'client_secret', 'secret_key', 'api_key', 'webhook_secret',
    'password', 'auth_token', 'authorization', 'access_token', 'refresh_token',
    'stripe_secret_key', 'stripe_webhook_secret', 'simulated_webhook_secret'
}

# Keys where we may preserve a safe masked representation (e.g. last 4 digits)
MASKABLE_KEYS = {'card_number', 'cardnumber', 'pan', 'primary_account_number'}


def mask_card_number(val: str) -> str:
    """
    Masks a card number string, retaining only the last 4 digits (e.g. ****-****-****-4242).
    """
    if not val or not isinstance(val, str):
        return '[REDACTED]'
    clean = re.sub(r'\D', '', val)
    if len(clean) < 4:
        return '[REDACTED]'
    last4 = clean[-4:]
    return f"****-****-****-{last4}"


def detect_card_brand(raw_card_number: str) -> str:
    """
    Detects card brand from BIN prefix without storing the number.
    """
    clean = re.sub(r'\D', '', str(raw_card_number or ''))
    if not clean:
        return 'Unknown'
    if clean.startswith('4'):
        return 'Visa'
    elif clean.startswith(('34', '37')):
        return 'American Express'
    elif clean.startswith(('51', '52', '53', '54', '55')) or (clean.startswith('2') and 2221 <= int(clean[:4]) <= 2720):
        return 'Mastercard'
    elif clean.startswith(('6011', '65')) or clean.startswith('644') or clean.startswith('645'):
        return 'Discover'
    return 'Card'


def extract_card_summary(raw_or_token: str) -> Dict[str, str]:
    """
    Safely extracts non-sensitive card metadata (brand and last 4 digits).
    Never stores or returns full PAN or CVV.
    """
    clean = re.sub(r'\D', '', str(raw_or_token or ''))
    if len(clean) >= 4:
        return {
            'card_brand': detect_card_brand(clean),
            'card_last4': clean[-4:],
        }
    return {
        'card_brand': 'Simulated',
        'card_last4': '4242',
    }


def sanitize_payment_data(data: Any) -> Any:
    """
    Recursively scrubs raw card numbers, CVVs, passwords, tokens, and payment secrets
    from dictionaries, lists, strings, and query structures.
    Ensures safe persistence in gateway_response and audit logs.
    """
    if data is None:
        return None

    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_lower = str(key).lower().strip()
            if key_lower in SENSITIVE_KEYS:
                if key_lower in MASKABLE_KEYS and isinstance(value, str):
                    sanitized[key] = mask_card_number(value)
                else:
                    sanitized[key] = '[REDACTED]'
            elif isinstance(value, (dict, list, tuple)):
                sanitized[key] = sanitize_payment_data(value)
            elif isinstance(value, str):
                # Redact any card patterns embedded within the string value
                sanitized[key] = PAN_REGEX.sub(lambda m: mask_card_number(m.group(0)), value)
            else:
                sanitized[key] = value
        return sanitized

    if isinstance(data, list):
        return [sanitize_payment_data(item) for item in data]

    if isinstance(data, tuple):
        return tuple(sanitize_payment_data(item) for item in data)

    if isinstance(data, str):
        return PAN_REGEX.sub(lambda m: mask_card_number(m.group(0)), data)

    return data
