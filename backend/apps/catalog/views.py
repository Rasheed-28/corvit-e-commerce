import uuid
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.common.permissions import IsAdminOrReadOnly, IsOwnerOrAdmin
from .models import ProductCategory, Product, ProductImage, ProductVariant, Review
from .serializers import (
    ProductCategorySerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateUpdateSerializer,
    ProductVariantSerializer,
    ProductVariantCreateUpdateSerializer,
    ProductImageSerializer,
    ReviewSerializer,
)
from .filters import ProductFilter


def get_product_by_identifier(identifier: str, queryset=None):
    """
    Retrieves a product instance by either UUID or slug.
    """
    if queryset is None:
        queryset = Product.objects.all()

    is_uuid = False
    try:
        uuid.UUID(str(identifier))
        is_uuid = True
    except (ValueError, AttributeError):
        is_uuid = False

    filter_kwargs = {'id': identifier} if is_uuid else {'slug__iexact': identifier}
    return get_object_or_404(queryset, **filter_kwargs)


class CategoryListCreateView(generics.ListCreateAPIView):
    """
    Public listing of product categories. Creating categories requires administrative privileges.
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductCategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        is_staff = getattr(self.request.user, 'is_staff', False) if self.request else False
        qs = ProductCategory.objects.all() if is_staff else ProductCategory.objects.filter(is_active=True)

        # Allow flat category listing via query parameter; default to hierarchical root categories
        flat = self.request.query_params.get('flat', 'false').lower() in ('true', '1', 'yes') if self.request else False
        if not flat:
            qs = qs.filter(parent__isnull=True)
        return qs.select_related('parent').prefetch_related('children')

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
    Public category details. Modifying or deleting categories requires administrative privileges.
    """
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = ProductCategorySerializer
    lookup_field = 'slug'
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        is_staff = getattr(self.request.user, 'is_staff', False) if self.request else False
        if is_staff:
            return ProductCategory.objects.all().select_related('parent').prefetch_related('children')
        return ProductCategory.objects.filter(is_active=True).select_related('parent').prefetch_related('children')

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
            'message': 'Category updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Category deleted successfully.'
        }, status=status.HTTP_200_OK)


class ProductListCreateView(generics.ListCreateAPIView):
    """
    Public catalog listing with search, filtering, and pagination.
    Creating products is restricted to administrative staff.
    """
    permission_classes = [IsAdminOrReadOnly]
    queryset = Product.objects.all()
    filterset_class = ProductFilter
    search_fields = [
        'title', 'description', 'sku',
        'category__name', 'category__slug',
        'variants__name', 'variants__sku'
    ]
    ordering_fields = ['base_price', 'created_at', 'title']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request and self.request.method == 'POST':
            return ProductCreateUpdateSerializer
        return ProductListSerializer

    def get_queryset(self):
        qs = Product.objects.select_related(
            'category', 'category__parent'
        ).prefetch_related(
            'images',
            'variants__inventory'
        )

        is_staff = getattr(self.request.user, 'is_staff', False) if self.request else False
        if is_staff:
            return qs
        return qs.filter(is_active=True)

    def filter_queryset(self, queryset):
        # Support sort query parameter alias for frontend convenience
        if self.request:
            sort_param = self.request.query_params.get('sort')
            if sort_param and 'ordering' not in self.request.query_params:
                sort_map = {
                    'price_asc': 'base_price',
                    'price_desc': '-base_price',
                    'newest': '-created_at',
                    'oldest': 'created_at',
                    'title_asc': 'title',
                    'title_desc': '-title',
                }
                if sort_param in sort_map:
                    request_get = self.request.GET.copy()
                    request_get['ordering'] = sort_map[sort_param]
                    self.request._request.GET = request_get

        return super().filter_queryset(queryset)

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
        product = serializer.save()
        return Response({
            'success': True,
            'message': 'Product created successfully.',
            'data': ProductDetailSerializer(product, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Public detailed product view with gallery, variants, and stock summary.
    Creating, updating, publishing, or deleting products requires administrative privileges.
    Supports lookup by either slug or UUID identifier.
    """
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.request and self.request.method in ('PUT', 'PATCH'):
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        qs = Product.objects.select_related(
            'category', 'category__parent'
        ).prefetch_related(
            'images',
            'variants__inventory',
            'reviews__user'
        )

        is_staff = getattr(self.request.user, 'is_staff', False) if self.request else False
        if is_staff:
            return qs
        return qs.filter(is_active=True)

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        identifier = self.kwargs.get(lookup_url_kwarg)

        obj = get_product_by_identifier(identifier, queryset=queryset)
        self.check_object_permissions(self.request, obj)
        return obj

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
        product = serializer.save()
        return Response({
            'success': True,
            'message': 'Product updated successfully.',
            'data': ProductDetailSerializer(product, context={'request': request}).data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Product deleted successfully.'
        }, status=status.HTTP_200_OK)


class ProductPublishView(APIView):
    """
    Administrative endpoint to publish a product (is_active=True).
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, slug):
        product = get_product_by_identifier(slug)
        product.is_active = True
        product.save(update_fields=['is_active', 'updated_at'])
        return Response({
            'success': True,
            'message': f"Product '{product.title}' published successfully.",
            'data': ProductDetailSerializer(product, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ProductUnpublishView(APIView):
    """
    Administrative endpoint to unpublish a product (is_active=False).
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, slug):
        product = get_product_by_identifier(slug)
        product.is_active = False
        product.save(update_fields=['is_active', 'updated_at'])
        return Response({
            'success': True,
            'message': f"Product '{product.title}' unpublished successfully.",
            'data': ProductDetailSerializer(product, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ProductVariantListCreateView(APIView):
    """
    Public listing of active variants or administrative variant creation.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get(self, request, slug):
        product = get_product_by_identifier(slug)
        variants = product.variants.select_related('inventory').all()
        if not getattr(request.user, 'is_staff', False):
            variants = variants.filter(is_active=True)
        serializer = ProductVariantSerializer(variants, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def post(self, request, slug):
        product = get_product_by_identifier(slug)
        serializer = ProductVariantCreateUpdateSerializer(data=request.data, context={'product': product})
        serializer.is_valid(raise_exception=True)
        variant = serializer.save()
        return Response({
            'success': True,
            'message': 'Product variant created successfully.',
            'data': ProductVariantSerializer(variant).data
        }, status=status.HTTP_201_CREATED)


class ProductVariantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Administrative endpoint to retrieve, update, or delete a product variant.
    """
    permission_classes = [permissions.IsAdminUser]
    serializer_class = ProductVariantCreateUpdateSerializer
    lookup_field = 'id'
    queryset = ProductVariant.objects.all().select_related('inventory')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return Response({
            'success': True,
            'data': ProductVariantSerializer(instance).data
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        variant = serializer.save()
        return Response({
            'success': True,
            'message': 'Product variant updated successfully.',
            'data': ProductVariantSerializer(variant).data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Product variant deleted successfully.'
        }, status=status.HTTP_200_OK)


class ProductImageListCreateView(APIView):
    """
    Lists product gallery images or uploads a new product image.
    Validates uploaded image file size and content integrity.
    """
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get(self, request, slug):
        product = get_product_by_identifier(slug)
        images = product.images.all()
        serializer = ProductImageSerializer(images, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })

    def post(self, request, slug):
        product = get_product_by_identifier(slug)
        serializer = ProductImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.save(product=product)
        return Response({
            'success': True,
            'message': 'Image uploaded successfully.',
            'data': ProductImageSerializer(image, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class ProductImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Administrative endpoint to update image flags or delete an image.
    """
    permission_classes = [permissions.IsAdminUser]
    serializer_class = ProductImageSerializer
    lookup_field = 'id'
    queryset = ProductImage.objects.all()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        image = serializer.save()
        return Response({
            'success': True,
            'message': 'Product image updated successfully.',
            'data': ProductImageSerializer(image, context={'request': request}).data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Product image deleted successfully.'
        }, status=status.HTTP_200_OK)


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
        return get_product_by_identifier(slug, queryset=Product.objects.filter(is_active=True))

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


class ProductReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieves, updates, or deletes a specific customer review.
    Enforces strict ownership checks: regular customers can only modify or delete their own review.
    Administrative staff can moderate, approve, or delete any review.
    """
    serializer_class = ReviewSerializer
    lookup_field = 'id'
    queryset = Review.objects.all()

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsOwnerOrAdmin()]

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
        self.check_object_permissions(request, instance)
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': 'Review updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Review deleted successfully.'
        }, status=status.HTTP_200_OK)
