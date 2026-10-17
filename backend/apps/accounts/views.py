from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.permissions import IsOwnerOrAdmin
from .models import Address
from .cookies import set_jwt_cookies, clear_jwt_cookies
from .services import send_password_reset_email
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    PasswordChangeSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    AddressSerializer,
    UserSummarySerializer,
)

User = get_user_model()

@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfCookieView(APIView):
    """
    Public endpoint to initialize or retrieve the CSRF token cookie.
    Sets the standard 'csrftoken' cookie readable by JavaScript for X-CSRFToken headers.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        csrf_token = get_token(request)
        return Response({
            'success': True,
            'message': 'CSRF cookie established.',
            'data': {
                'csrfToken': csrf_token
            }
        }, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    Public registration endpoint for new customer accounts.
    Sets secure HttpOnly JWT cookies and returns user summary and tokens.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT authentication tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'success': True,
            'message': 'Account registered successfully.',
            'data': {
                'user': UserSummarySerializer(user).data,
                'tokens': {
                    'access': access_token,
                    'refresh': refresh_token,
                }
            }
        }, status=status.HTTP_201_CREATED)

        # Set secure HttpOnly cookies and ensure CSRF token cookie is present
        set_jwt_cookies(response, access_token, refresh_token)
        get_token(request)
        return response


class LoginView(APIView):
    """
    Enhanced login endpoint accepting username or email. Sets secure HttpOnly
    auth cookies and returns standard envelope with user metadata and tokens.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({
                'success': False,
                'error': {
                    'code': 'INVALID_CREDENTIALS',
                    'message': 'Invalid username or password.',
                    'details': serializer.errors
                }
            }, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data['user']
        update_last_login(None, user)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'success': True,
            'message': 'Login successful.',
            'data': {
                'user': UserSummarySerializer(user).data,
                'tokens': {
                    'access': access_token,
                    'refresh': refresh_token,
                }
            }
        }, status=status.HTTP_200_OK)

        # Set HttpOnly cookies for SPA and attach CSRF cookie
        set_jwt_cookies(response, access_token, refresh_token)
        get_token(request)
        return response


class LogoutView(APIView):
    """
    Logout endpoint that blacklists the active refresh token and clears HttpOnly auth cookies.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')
        refresh_token = request.data.get('refresh') or request.COOKIES.get(cookie_name)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({
            'success': True,
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)

        clear_jwt_cookies(response)
        return response


class CustomTokenRefreshView(APIView):
    """
    Refreshes access and refresh tokens using either HttpOnly cookie or request payload.
    Rotates the refresh token and invalidates the previous token.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')
        refresh_token = request.data.get('refresh') or request.COOKIES.get(cookie_name)

        if not refresh_token:
            return Response({
                'success': False,
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Refresh token is required.',
                    'details': {'refresh': ['This field is required.']}
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(refresh_token)
            user_id = refresh.payload.get('user_id')
            user = User.objects.get(id=user_id, is_active=True)
        except Exception:
            response = Response({
                'success': False,
                'error': {
                    'code': 'TOKEN_INVALID',
                    'message': 'Refresh token is invalid or expired.',
                    'details': None
                }
            }, status=status.HTTP_401_UNAUTHORIZED)
            clear_jwt_cookies(response)
            return response

        # Rotate refresh token
        try:
            refresh.blacklist()
        except AttributeError:
            pass

        new_refresh = RefreshToken.for_user(user)
        new_access_token = str(new_refresh.access_token)
        new_refresh_token = str(new_refresh)

        response = Response({
            'success': True,
            'message': 'Token refreshed successfully.',
            'data': {
                'tokens': {
                    'access': new_access_token,
                    'refresh': new_refresh_token,
                }
            }
        }, status=status.HTTP_200_OK)

        set_jwt_cookies(response, new_access_token, new_refresh_token)
        return response


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Protected endpoint to view and update the logged-in customer's profile.
    Client-supplied roles, usernames, emails, or IDs are strictly rejected/ignored.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': 'Profile updated successfully.',
            'data': serializer.data
        })


class PasswordChangeView(APIView):
    """
    Protected endpoint allowing authenticated users to change their password.
    Requires current password verification and validates new password strength.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        new_password = serializer.validated_data['new_password']
        user.set_password(new_password)
        user.save()

        # Re-issue active tokens and cookies so the current session continues securely
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'success': True,
            'message': 'Password changed successfully.',
            'data': {
                'tokens': {
                    'access': access_token,
                    'refresh': refresh_token
                }
            }
        }, status=status.HTTP_200_OK)

        set_jwt_cookies(response, access_token, refresh_token)
        return response


class PasswordResetRequestView(APIView):
    """
    Public endpoint initiating password reset by sending a one-time token link.
    Guards against email enumeration by returning identical generic success envelopes.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            send_password_reset_email(user)

        # Anti-enumeration response
        return Response({
            'success': True,
            'message': 'If an account with that email exists, password reset instructions have been sent.'
        }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    Public endpoint validating one-time token and completing password reset.
    Token is invalidated immediately upon successful password change.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']
        user.set_password(new_password)
        user.save()

        return Response({
            'success': True,
            'message': 'Password has been reset successfully. You can now log in with your new password.'
        }, status=status.HTTP_200_OK)


class AddressListCreateView(generics.ListCreateAPIView):
    """
    Lists customer's saved addresses or creates a new address.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AddressSerializer
    queryset = Address.objects.all()

    def get_queryset(self):
        if not self.request or not self.request.user.is_authenticated:
            return Address.objects.none()
        return Address.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'success': True,
            'message': 'Address saved successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieves, updates, or deletes a specific saved customer address.
    Regular customers can only access their own address. Staff can manage any address.
    """
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    serializer_class = AddressSerializer
    lookup_field = 'id'
    queryset = Address.objects.all()

    def get_queryset(self):
        if not self.request or not self.request.user.is_authenticated:
            return Address.objects.none()
        if self.request.user.is_staff:
            return Address.objects.all()
        return Address.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': 'Address updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Address deleted successfully.'
        }, status=status.HTTP_200_OK)
