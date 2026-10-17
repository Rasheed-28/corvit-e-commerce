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


from django.http import HttpResponse
from rest_framework.schemas import get_schema_view
from rest_framework.renderers import JSONOpenAPIRenderer

openapi_schema_view = get_schema_view(
    title="NovaStore E-Commerce API",
    version="v1",
    description="Enterprise Multi-Domain REST Framework API with JWT and Cookie Authentication",
    renderer_classes=[JSONOpenAPIRenderer],
    public=True,
    permission_classes=[AllowAny],
)

def swagger_ui_view(request):
    """
    Renders interactive Swagger UI pointing to the OpenAPI v1 schema.
    """
    html = """<!DOCTYPE html>
<html>
  <head>
    <title>NovaStore API - Swagger UI</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function() {
        SwaggerUIBundle({
          url: "/api/v1/common/schema/",
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout"
        });
      };
    </script>
  </body>
</html>"""
    return HttpResponse(html)

def redoc_ui_view(request):
    """
    Renders interactive ReDoc documentation pointing to the OpenAPI v1 schema.
    """
    html = """<!DOCTYPE html>
<html>
  <head>
    <title>NovaStore API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/api/v1/common/schema/"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>"""
    return HttpResponse(html)


