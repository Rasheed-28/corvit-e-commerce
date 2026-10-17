from django.urls import path
from .views import (
    HealthCheckView,
    openapi_schema_view,
    swagger_ui_view,
    redoc_ui_view,
)

app_name = 'common'

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('schema/', openapi_schema_view, name='openapi-schema'),
    path('docs/', swagger_ui_view, name='swagger-ui'),
    path('redoc/', redoc_ui_view, name='redoc-ui'),
]

