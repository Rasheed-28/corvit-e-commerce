from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from .models import Cart, CartItem, Wishlist, WishlistItem
from .serializers import (
    CartSerializer,
    AddToCartSerializer,
    UpdateCartItemSerializer,
    WishlistItemSerializer,
    AddWishlistSerializer,
)

def get_or_create_cart(request) -> Cart:
    """
    Retrieves the active cart for either an authenticated user or a guest session.
    """
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user, is_active=True)
        return cart

    if not request.session.session_key:
        request.session.create()
    cart, _ = Cart.objects.get_or_create(session_key=request.session.session_key, is_active=True)
    return cart


class CartView(APIView):
    """
    Retrieves the active shopping cart and its calculated totals.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cart = get_or_create_cart(request)
        serializer = CartSerializer(cart)
        return Response({
            'success': True,
            'data': serializer.data
        })


class AddToCartView(APIView):
    """
    Adds a product or variant to the shopping cart, updating existing quantity if already present.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = serializer.validated_data['product_obj']
        variant = serializer.validated_data.get('variant_obj')
        quantity = serializer.validated_data['quantity']

        cart = get_or_create_cart(request)

        unit_price = variant.effective_price if variant else product.base_price

        with transaction.atomic():
            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                product=product,
                variant=variant,
                defaults={
                    'quantity': quantity,
                    'unit_price': unit_price,
                }
            )
            if not created:
                cart_item.quantity += quantity
                cart_item.unit_price = unit_price
                cart_item.save()

        # Return refreshed cart
        cart.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Item added to cart.',
            'data': CartSerializer(cart).data
        }, status=status.HTTP_200_OK)


class CartItemDetailView(APIView):
    """
    Updates or removes a specific line item in the active cart.
    """
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id):
        cart = get_or_create_cart(request)
        item = get_object_or_404(CartItem, id=id, cart=cart)

        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_qty = serializer.validated_data['quantity']

        # Verify stock if variant is present
        if item.variant and hasattr(item.variant, 'inventory'):
            if item.variant.inventory.available_quantity < new_qty:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'INSUFFICIENT_STOCK',
                        'message': f"Only {item.variant.inventory.available_quantity} units available.",
                        'details': None
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

        item.quantity = new_qty
        item.save()

        return Response({
            'success': True,
            'message': 'Cart item updated.',
            'data': CartSerializer(cart).data
        })

    def delete(self, request, id):
        cart = get_or_create_cart(request)
        item = get_object_or_404(CartItem, id=id, cart=cart)
        item.delete()

        return Response({
            'success': True,
            'message': 'Item removed from cart.',
            'data': CartSerializer(cart).data
        })


class ClearCartView(APIView):
    """
    Empties all items from the current active shopping cart.
    """
    permission_classes = [permissions.AllowAny]

    def delete(self, request):
        cart = get_or_create_cart(request)
        cart.items.all().delete()
        return Response({
            'success': True,
            'message': 'Shopping cart cleared.',
            'data': CartSerializer(cart).data
        })


class WishlistView(APIView):
    """
    Lists and manages saved items in the authenticated customer's wishlist.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        items = wishlist.items.select_related('product__category').prefetch_related('product__images')
        serializer = WishlistItemSerializer(items, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })

    def post(self, request):
        serializer = AddWishlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product_id = serializer.validated_data['product_id']

        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        item, created = WishlistItem.objects.get_or_create(
            wishlist=wishlist,
            product_id=product_id
        )

        return Response({
            'success': True,
            'message': 'Product added to wishlist.' if created else 'Product already in wishlist.',
            'data': WishlistItemSerializer(item, context={'request': request}).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class WishlistItemDeleteView(APIView):
    """
    Removes a specific product from the authenticated customer's wishlist.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, product_id):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        item = get_object_or_404(WishlistItem, wishlist=wishlist, product_id=product_id)
        item.delete()
        return Response({
            'success': True,
            'message': 'Product removed from wishlist.'
        })
