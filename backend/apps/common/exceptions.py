import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

class ApplicationDomainException(Exception):
    """
    Base exception for all business domain errors.
    """
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "DOMAIN_ERROR"
    default_message = "A business rule validation error occurred."

    def __init__(self, message=None, code=None, details=None, status_code=None):
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.details = details or []
        if status_code:
            self.status_code = status_code
        super().__init__(self.message)


def custom_exception_handler(exc, context):
    """
    Custom exception handler to standardize all API error outputs into the unified envelope.
    """
    # Call DRF's default exception handler first to get the standard error response
    response = exception_handler(exc, context)

    # Handle domain-specific business exceptions
    if isinstance(exc, ApplicationDomainException):
        return Response({
            'success': False,
            'error': {
                'code': exc.code,
                'message': exc.message,
                'details': exc.details,
            }
        }, status=exc.status_code)

    # If DRF handled the error (e.g., 400 ValidationError, 401, 403, 404)
    if response is not None:
        error_code = 'VALIDATION_ERROR'
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_code = 'UNAUTHORIZED'
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_code = 'FORBIDDEN'
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            error_code = 'NOT_FOUND'
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            error_code = 'RATE_LIMIT_EXCEEDED'

        # Extract message and details
        message = 'Invalid input provided.'
        details = response.data

        if isinstance(response.data, dict) and 'detail' in response.data:
            message = str(response.data['detail'])
            details = None
        elif isinstance(response.data, dict) and response.data:
            first_val = next(iter(response.data.values()))
            if isinstance(first_val, list) and len(first_val) > 0:
                message = str(first_val[0])
            elif isinstance(first_val, str):
                message = first_val

        response.data = {
            'success': False,
            'error': {
                'code': error_code,
                'message': message,
                'details': details,
            }
        }
        return response

    # Unhandled 500 server error
    logger.exception("Unhandled server exception: %s", exc, exc_info=context.get('request'))
    return Response({
        'success': False,
        'error': {
            'code': 'INTERNAL_SERVER_ERROR',
            'message': 'An unexpected server error occurred.',
            'details': None,
        }
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
