from django.urls import path
from .views import (
    CsrfCookieView,
    RegisterView,
    LoginView,
    LogoutView,
    CustomTokenRefreshView,
    UserProfileView,
    PasswordChangeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    AddressListCreateView,
    AddressDetailView,
)

app_name = 'accounts'

urlpatterns = [
    path('csrf/', CsrfCookieView.as_view(), name='csrf-cookie'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token-refresh'),
    path('me/', UserProfileView.as_view(), name='user-profile'),
    path('password/change/', PasswordChangeView.as_view(), name='password-change'),
    path('password/reset/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('addresses/', AddressListCreateView.as_view(), name='address-list-create'),
    path('addresses/<uuid:id>/', AddressDetailView.as_view(), name='address-detail'),
]
