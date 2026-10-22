from django.urls import path
from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    ProductListCreateView,
    ProductDetailView,
    ProductPublishView,
    ProductUnpublishView,
    ProductVariantListCreateView,
    ProductVariantDetailView,
    ProductImageListCreateView,
    ProductImageDetailView,
    ProductReviewListCreateView,
    ProductReviewDetailView,
    ProductUserReviewView,
)

app_name = 'catalog'

urlpatterns = [
    # Categories
    path('categories/', CategoryListCreateView.as_view(), name='category-list-create'),
    path('categories/<slug:slug>/', CategoryDetailView.as_view(), name='category-detail'),

    # Products (List & Detail supporting slug or UUID)
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<str:slug>/', ProductDetailView.as_view(), name='product-detail'),

    # Publishing controls
    path('products/<str:slug>/publish/', ProductPublishView.as_view(), name='product-publish'),
    path('products/<str:slug>/unpublish/', ProductUnpublishView.as_view(), name='product-unpublish'),

    # Product Variants & Stock
    path('products/<str:slug>/variants/', ProductVariantListCreateView.as_view(), name='product-variant-list-create'),
    path('variants/<uuid:id>/', ProductVariantDetailView.as_view(), name='variant-detail'),

    # Product Media Gallery
    path('products/<str:slug>/images/', ProductImageListCreateView.as_view(), name='product-image-list-create'),
    path('images/<uuid:id>/', ProductImageDetailView.as_view(), name='image-detail'),

    # Reviews
    path('products/<str:slug>/reviews/mine/', ProductUserReviewView.as_view(), name='product-user-review'),
    path('products/<str:slug>/reviews/', ProductReviewListCreateView.as_view(), name='product-review-list-create'),
    path('reviews/<uuid:id>/', ProductReviewDetailView.as_view(), name='review-detail'),
]

