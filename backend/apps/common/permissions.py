from rest_framework import permissions

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access for any request, but restricts write operations to staff/admin users.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Allows object-level access only to the resource owner or an administrator.
    """
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_staff:
            return True
        # Check if the object has a user or customer attribute
        owner = getattr(obj, 'user', None) or getattr(obj, 'customer', None)
        return owner == request.user
