from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.db import connection

class HealthCheckView(APIView):
    """
    Health check endpoint returning system status, database connectivity, and engine type.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = 'connected'
        db_vendor = connection.vendor
        is_healthy = True
        try:
            connection.ensure_connection()
        except Exception as e:
            db_status = f'error: {str(e)}'
            is_healthy = False

        status_code = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

        return Response({
            'success': is_healthy,
            'data': {
                'status': 'healthy' if is_healthy else 'unhealthy',
                'database': db_status,
                'engine': db_vendor,
                'version': '0.1.0',
            }
        }, status=status_code)

