import logging
from typing import Any
from .sanitizer import sanitize_payment_data

class SensitiveDataFilter(logging.Filter):
    """
    Log filter that scrubs credit card numbers, CVVs, API secrets,
    and authentication tokens from all log record messages and arguments.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = str(sanitize_payment_data(record.msg))
        if record.args:
            if isinstance(record.args, dict):
                record.args = sanitize_payment_data(record.args)
            elif isinstance(record.args, (list, tuple)):
                record.args = tuple(sanitize_payment_data(arg) for arg in record.args)
        return True


payment_logger = logging.getLogger('apps.payments')
if not any(isinstance(f, SensitiveDataFilter) for f in payment_logger.filters):
    payment_logger.addFilter(SensitiveDataFilter())
