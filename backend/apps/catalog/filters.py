import django_filters
from django.db.models import Q
from .models import Product

class ProductFilter(django_filters.FilterSet):
    min_price = django_filters.NumberFilter(field_name='base_price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='base_price', lookup_expr='lte')
    category = django_filters.CharFilter(method='filter_category')
    is_featured = django_filters.BooleanFilter(field_name='is_featured')
    in_stock = django_filters.BooleanFilter(method='filter_in_stock')

    class Meta:
        model = Product
        fields = ['category', 'is_featured', 'min_price', 'max_price']

    def filter_category(self, queryset, name, value):
        # Support filtering by parent category slug or child category slug
        return queryset.filter(
            Q(category__slug=value) | Q(category__parent__slug=value)
        )

    def filter_in_stock(self, queryset, name, value):
        if value is True:
            return queryset.filter(variants__inventory__quantity__gt=0).distinct()
        elif value is False:
            return queryset.filter(variants__inventory__quantity__lte=0).distinct()
        return queryset
