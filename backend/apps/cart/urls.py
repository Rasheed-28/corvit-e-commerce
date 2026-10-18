from django.urls import path
from .views import (
    CartView,
    AddToCartView,
    CartItemDetailView,
    ClearCartView,
    MergeCartView,
    WishlistView,
    WishlistItemDeleteView,
    WishlistClearView,
)

app_name = 'cart'

urlpatterns = [
    path('', CartView.as_view(), name='cart-detail'),
    path('items/', AddToCartView.as_view(), name='cart-add-item'),
    path('items/<uuid:id>/', CartItemDetailView.as_view(), name='cart-item-detail'),
    path('clear/', ClearCartView.as_view(), name='cart-clear'),
    path('merge/', MergeCartView.as_view(), name='cart-merge'),
    path('wishlist/', WishlistView.as_view(), name='wishlist-list-create'),
    path('wishlist/clear/', WishlistClearView.as_view(), name='wishlist-clear'),
    path('wishlist/<uuid:product_id>/', WishlistItemDeleteView.as_view(), name='wishlist-delete-item'),
]
