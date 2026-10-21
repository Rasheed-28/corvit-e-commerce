from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/common/', include('apps.common.urls')),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/catalog/', include('apps.catalog.urls')),
    path('api/v1/cart/', include('apps.cart.urls')),
    path('api/v1/orders/', include('apps.orders.urls')),
    path('api/v1/payments/', include('apps.payments.urls')),
    path('api/v1/admin/', include('apps.administration.urls')),
]

# Serve media files in local development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
