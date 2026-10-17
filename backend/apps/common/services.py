from django.db import connection

class SystemHealthService:
    """
    Domain service layer to encapsulate infrastructure health checks and database connectivity diagnostics.
    """
    @staticmethod
    def get_health_status() -> dict:
        db_status = 'connected'
        try:
            connection.ensure_connection()
        except Exception as exc:
            db_status = f'error: {str(exc)}'

        return {
            'status': 'healthy' if db_status == 'connected' else 'unhealthy',
            'database': db_status,
            'version': '0.1.0',
        }
