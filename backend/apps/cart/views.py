from decimal import Decimal
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from apps.catalog.models import Inventory
from .models import Cart, CartItem, Wishlist, WishlistItem
from .services import (
    get_or_create_cart,
    merge_guest_cart_into_user,
    get_cart_session_key,
    MAX_PURCHASE_LIMIT,
)
from .serializers import (
    CartSerializer,
    AddToCartSerializer,
    UpdateCartItemSerializer,
    MergeCartSerializer,
    WishlistItemSerializer,
    AddWishlistSerializer,
)


class CartView(APIView):
    """
    Retrieves the active shopping cart and its calculated totals.
    Supports authenticated users and anonymous sessions with auto-merging.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cart = get_or_create_cart(request)
        serializer = CartSerializer(cart, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })


class AddToCartView(APIView):
    """
    Adds a product or variant to the shopping cart with concurrency protection.
    Never trusts client totals or pricing baseline; strictly calculates server-side.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        serializer = AddToCartSerializer(data=request.data, context={'request': request, 'cart': cart})
        serializer.is_valid(raise_exception=True)

        product = serializer.validated_data['product_obj']
        variant = serializer.validated_data.get('variant_obj')
        quantity = serializer.validated_data['quantity']

        unit_price = variant.effective_price if variant else product.base_price

        with transaction.atomic():
            # Apply row-level lock on inventory if present
            available_stock = None
            if variant and hasattr(variant, 'inventory'):
                inv = Inventory.objects.select_for_update().filter(id=variant.inventory.id).first()
                if inv:
                    available_stock = inv.available_quantity

            # Apply row-level lock on cart item
            cart_item = CartItem.objects.select_for_update().filter(
                cart=cart, product=product, variant=variant
            ).first()

            current_qty = cart_item.quantity if cart_item else 0
            new_qty = current_qty + quantity

            if new_qty > MAX_PURCHASE_LIMIT:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'PURCHASE_LIMIT_EXCEEDED',
                        'message': f"Cannot exceed purchase limit of {MAX_PURCHASE_LIMIT} units. You currently have {current_qty} in cart.",
                        'details': None
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            if available_stock is not None and new_qty > available_stock:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'INSUFFICIENT_STOCK',
                        'message': f"Only {available_stock} units available in stock. You currently have {current_qty} in cart.",
                        'details': None
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            if cart_item:
                cart_item.quantity = new_qty
                cart_item.unit_price = unit_price
                cart_item.save()
            else:
                cart_item = CartItem.objects.create(
                    cart=cart,
                    product=product,
                    variant=variant,
                    quantity=quantity,
                    unit_price=unit_price
                )

        cart.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Item added to cart.',
            'data': CartSerializer(cart, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class CartItemDetailView(APIView):
    """
    Updates quantity or removes a specific line item in the active cart with stock validation.
    """
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id):
        cart = get_or_create_cart(request)
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_qty = serializer.validated_data['quantity']

        with transaction.atomic():
            item = CartItem.objects.select_for_update().filter(id=id, cart=cart).first()
            if not item:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'NOT_FOUND',
                        'message': 'Cart item not found in active basket.',
                        'details': None
                    }
                }, status=status.HTTP_404_NOT_FOUND)

            if new_qty > MAX_PURCHASE_LIMIT:
                return Response({
                    'success': False,
                    'error': {
                        'code': 'PURCHASE_LIMIT_EXCEEDED',
                        'message': f"Quantity cannot exceed maximum purchase limit of {MAX_PURCHASE_LIMIT}.",
                        'details': None
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check stock
            if item.variant and hasattr(item.variant, 'inventory'):
                inv = Inventory.objects.select_for_update().filter(id=item.variant.inventory.id).first()
                if inv and new_qty > inv.available_quantity:
                    return Response({
                        'success': False,
                        'error': {
                            'code': 'INSUFFICIENT_STOCK',
                            'message': f"Only {inv.available_quantity} units available in stock.",
                            'details': None
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)

            item.quantity = new_qty
            # Synchronize price from database
            item.unit_price = item.variant.effective_price if item.variant else item.product.base_price
            item.save()

        cart.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Cart item updated.',
            'data': CartSerializer(cart, context={'request': request}).data
        })

    def delete(self, request, id):
        cart = get_or_create_cart(request)
        item = get_object_or_404(CartItem, id=id, cart=cart)
        item.delete()

        cart.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Item removed from cart.',
            'data': CartSerializer(cart, context={'request': request}).data
        })


class ClearCartView(APIView):
    """
    Empties all items from the current active shopping cart.
    """
    permission_classes = [permissions.AllowAny]

    def delete(self, request):
        cart = get_or_create_cart(request)
        cart.items.all().delete()
        cart.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Shopping cart cleared.',
            'data': CartSerializer(cart, context={'request': request}).data
        })


class MergeCartView(APIView):
    """
    Merges an anonymous guest cart into the customer's active authenticated cart.
    Accepts session_key via body, header, or session cookie.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = MergeCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_key = serializer.validated_data.get('session_key') or get_cart_session_key(request)
        if not session_key:
            cart = get_or_create_cart(request)
            return Response({
                'success': True,
                'message': 'No guest cart to merge.',
                'data': CartSerializer(cart, context={'request': request}).data
            })

        cart = merge_guest_cart_into_user(session_key, request.user)
        return Response({
            'success': True,
            'message': 'Guest cart merged successfully.',
            'data': CartSerializer(cart, context={'request': request}).data
        })


class WishlistView(APIView):
    """
    Lists and manages saved items in the authenticated customer's wishlist.
    Handles unavailable/inactive products and prevents duplicate entries.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        items = wishlist.items.select_related(
            'product__category'
        ).prefetch_related(
            'product__images',
            'product__variants__inventory'
        )
        serializer = WishlistItemSerializer(items, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })

    def post(self, request):
        serializer = AddWishlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product_id = serializer.validated_data['product_id']

        with transaction.atomic():
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
    Removes a specific product from the customer's wishlist by product ID.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, product_id):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        item = WishlistItem.objects.filter(wishlist=wishlist, product_id=product_id).first()
        if not item:
            return Response({
                'success': False,
                'error': {
                    'code': 'NOT_FOUND',
                    'message': 'Product not found in your wishlist.',
                    'details': None
                }
            }, status=status.HTTP_404_NOT_FOUND)

        item.delete()
        return Response({
            'success': True,
            'message': 'Product removed from wishlist.'
        })


class WishlistClearView(APIView):
    """
    Clears all saved items from the customer's wishlist.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        wishlist.items.all().delete()
        return Response({
            'success': True,
            'message': 'Wishlist cleared.'
        })
