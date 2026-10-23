from decimal import Decimal
import uuid
from django.db import transaction
from django.conf import settings
from apps.catalog.models import Product, ProductVariant, Inventory
from .models import Cart, CartItem, Wishlist, WishlistItem

MAX_PURCHASE_LIMIT = getattr(settings, 'CART_MAX_PURCHASE_LIMIT', 10)


def get_cart_session_key(request) -> str | None:
    """
    Extracts the anonymous cart session identifier from request headers, payload, or session.
    """
    session_key = (
        request.headers.get('X-Cart-Session') or
        request.headers.get('X-Session-Key') or
        (request.data.get('session_key') if isinstance(getattr(request, 'data', None), dict) else None) or
        (request.query_params.get('session_key') if hasattr(request, 'query_params') else None) or
        (request.session.session_key if hasattr(request, 'session') and request.session.session_key else None)
    )
    return session_key


def get_or_create_cart(request) -> Cart:
    """
    Retrieves or creates the active shopping cart for an authenticated customer or guest session.
    Automatically merges anonymous guest cart into user cart if customer is authenticated.
    """
    if request.user.is_authenticated:
        cart = Cart.objects.filter(user=request.user, is_active=True).first()
        if not cart:
            cart = Cart.objects.create(user=request.user, is_active=True)
        # Deactivate any duplicate active carts if they exist
        other_active = Cart.objects.filter(user=request.user, is_active=True).exclude(id=cart.id)
        if other_active.exists():
            other_active.update(is_active=False)

        # Check if an anonymous guest cart is present to merge
        session_key = get_cart_session_key(request)
        if session_key:
            guest_cart = Cart.objects.filter(session_key=session_key, user__isnull=True, is_active=True).first()
            if guest_cart and guest_cart.id != cart.id:
                merge_guest_cart_into_user(session_key, request.user)
                cart.refresh_from_db()
        return cart

    # Anonymous guest session
    session_key = get_cart_session_key(request)
    if not session_key:
        if hasattr(request, 'session'):
            if not request.session.session_key:
                request.session.create()
            session_key = request.session.session_key
        else:
            session_key = uuid.uuid4().hex

    cart = Cart.objects.filter(session_key=session_key, user__isnull=True, is_active=True).first()
    if not cart:
        cart = Cart.objects.create(session_key=session_key, user=None, is_active=True)
    other_guest_active = Cart.objects.filter(session_key=session_key, user__isnull=True, is_active=True).exclude(id=cart.id)
    if other_guest_active.exists():
        other_guest_active.update(is_active=False)
    return cart


def merge_guest_cart_into_user(session_key: str, user) -> Cart:
    """
    Merges items from an anonymous guest cart into the customer's active authenticated cart.
    Enforces available inventory and purchase limits. Deactivates guest cart once merged.
    """
    if not session_key or not user or not user.is_authenticated:
        return None

    guest_cart = Cart.objects.filter(session_key=session_key, user__isnull=True, is_active=True).first()
    user_cart = Cart.objects.filter(user=user, is_active=True).first()
    if not user_cart:
        user_cart = Cart.objects.create(user=user, is_active=True)
    if not guest_cart:
        return user_cart
    if guest_cart.id == user_cart.id:
        return user_cart

    with transaction.atomic():
        guest_items = guest_cart.items.select_related('product', 'variant').all()
        for g_item in guest_items:
            product = g_item.product
            variant = g_item.variant

            # Ignore deactivated products/variants
            if not product.is_active or (variant and not variant.is_active):
                continue

            # Determine available inventory with concurrency lock
            available_stock = None
            if variant and hasattr(variant, 'inventory'):
                inv = Inventory.objects.select_for_update().filter(id=variant.inventory.id).first()
                if inv:
                    available_stock = inv.available_quantity

            # Find existing item in user cart
            user_item = user_cart.items.select_for_update().filter(product=product, variant=variant).first()
            unit_price = variant.effective_price if variant else product.base_price

            if user_item:
                target_qty = user_item.quantity + g_item.quantity
                if available_stock is not None:
                    target_qty = min(target_qty, available_stock)
                target_qty = min(target_qty, MAX_PURCHASE_LIMIT)

                if target_qty > 0:
                    user_item.quantity = target_qty
                    user_item.unit_price = unit_price
                    user_item.save()
            else:
                target_qty = g_item.quantity
                if available_stock is not None:
                    target_qty = min(target_qty, available_stock)
                target_qty = min(target_qty, MAX_PURCHASE_LIMIT)

                if target_qty > 0:
                    CartItem.objects.create(
                        cart=user_cart,
                        product=product,
                        variant=variant,
                        quantity=target_qty,
                        unit_price=unit_price
                    )

        # Deactivate guest cart to prevent double merging
        guest_cart.items.all().delete()
        guest_cart.is_active = False
        guest_cart.save()

    user_cart.refresh_from_db()
    return user_cart
