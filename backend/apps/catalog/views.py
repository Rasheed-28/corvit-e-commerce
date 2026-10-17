from rest_framework import generics, status, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.common.permissions import IsAdminOrReadOnly
from .models import ProductCategory, Product, Review
from .serializers import (
    ProductCategorySerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ReviewSerializer,
)
from .filters import ProductFilter

class CategoryListCreateView(generics.ListCreateAPIView):
    """
    Public listing of categories. Creating categories requires administrative privileges.
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductCategorySerializer
    queryset = ProductCategory.objects.filter(is_active=True, parent__isnull=True)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
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
            'message': 'Category created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Public category details. Modification requires administrative privileges.
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductCategorySerializer
    lookup_field = 'slug'
    queryset = ProductCategory.objects.all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })


class ProductListCreateView(generics.ListCreateAPIView):
    """
    Public catalog listing with search, filtering, and pagination.
    Creating products is restricted to staff/admin users.
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductListSerializer
    queryset = Product.objects.all()
    filterset_class = ProductFilter
    search_fields = ['title', 'description', 'sku', 'category__name']
    ordering_fields = ['base_price', 'created_at', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        if self.request and getattr(self.request.user, 'is_staff', False):
            return Product.objects.all().select_related('category').prefetch_related('images')
        return Product.objects.filter(is_active=True).select_related('category').prefetch_related('images')

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
        serializer = ProductDetailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'success': True,
            'message': 'Product created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Public detailed product view with gallery and variants. Modifying products requires admin access.
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductDetailSerializer
    lookup_field = 'slug'
    queryset = Product.objects.all()

    def get_queryset(self):
        if self.request and getattr(self.request.user, 'is_staff', False):
            return Product.objects.all().select_related('category').prefetch_related('images', 'variants__inventory', 'reviews__user')
        return Product.objects.filter(is_active=True).select_related('category').prefetch_related('images', 'variants__inventory', 'reviews__user')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })


class ProductReviewListCreateView(generics.ListCreateAPIView):
    """
    Public list of approved reviews for a product. Posting a review requires an authenticated customer.
    """
    serializer_class = ReviewSerializer
    queryset = Review.objects.all()

    def get_permissions(self):
        if self.request and self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_product(self):
        slug = self.kwargs.get('slug') if self.kwargs else None
        return get_object_or_404(Product, slug=slug, is_active=True)

    def get_queryset(self):
        if not self.kwargs or 'slug' not in self.kwargs:
            return Review.objects.none()
        product = self.get_product()
        return product.reviews.filter(is_approved=True).select_related('user')

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
        product = self.get_product()
        # Verify user has not already submitted a review for this product
        if Review.objects.filter(product=product, user=request.user).exists():
            return Response({
                'success': False,
                'error': {
                    'code': 'DUPLICATE_REVIEW',
                    'message': 'You have already submitted a review for this product.',
                    'details': None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data, context={'request': request, 'product': product})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'success': True,
            'message': 'Review submitted successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
