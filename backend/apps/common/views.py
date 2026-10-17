from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db import connection

class HealthCheckView(APIView):
    """
    Health check endpoint returning system status and database connectivity.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = 'connected'
        try:
            connection.ensure_connection()
        except Exception as e:
            db_status = f'error: {str(e)}'

        return Response({
            'success': True,
            'data': {
                'status': 'healthy',
                'database': db_status,
                'version': '0.1.0',
            }
        })
