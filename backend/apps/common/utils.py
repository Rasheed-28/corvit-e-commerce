from typing import Any, Dict, Optional
from rest_framework.response import Response

def standard_response(
    data: Optional[Any] = None,
    message: Optional[str] = None,
    success: bool = True,
    status_code: int = 200,
) -> Response:
    """
    Standardized helper to structure uniform API responses across all endpoints.
    """
    payload: Dict[str, Any] = {'success': success}
    if data is not None:
        payload['data'] = data
    if message is not None:
        payload['message'] = message
    return Response(payload, status=status_code)
