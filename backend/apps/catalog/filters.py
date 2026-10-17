import django_filters
from django.db.models import Q
from .models import Product

class ProductFilter(django_filters.FilterSet):
    """
    FilterSet for Product catalogue supporting category, price bounds,
    stock availability, attribute filters, and publication state.
    """
    min_price = django_filters.NumberFilter(field_name='base_price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='base_price', lookup_expr='lte')
    category = django_filters.CharFilter(method='filter_category')
    is_featured = django_filters.BooleanFilter(field_name='is_featured')
    in_stock = django_filters.BooleanFilter(method='filter_in_stock')
    is_active = django_filters.BooleanFilter(method='filter_is_active')
    color = django_filters.CharFilter(method='filter_color')
    size = django_filters.CharFilter(method='filter_size')
    sku = django_filters.CharFilter(field_name='sku', lookup_expr='iexact')

    class Meta:
        model = Product
        fields = [
            'category', 'is_featured', 'min_price', 'max_price',
            'in_stock', 'is_active', 'color', 'size', 'sku'
        ]

    def is_valid(self):
        # Strictly validate boolean query parameters to prevent NullBooleanField from silently treating invalid values as None
        boolean_fields = ['is_featured', 'in_stock', 'is_active']
        for bf in boolean_fields:
            if bf in self.data:
                raw_val = self.data.get(bf)
                if raw_val not in (None, ''):
                    if str(raw_val).strip().lower() not in ('true', 'false', '1', '0', 't', 'f', 'yes', 'no'):
                        _ = self.form
                        self.form.add_error(bf, f"Enter a valid boolean value (true or false) for '{bf}'.")
                        return False

        valid = super().is_valid()
        if not valid:
            return False

        # Explicit domain validation for price ranges
        min_p = self.form.cleaned_data.get('min_price')
        max_p = self.form.cleaned_data.get('max_price')

        if min_p is not None and min_p < 0:
            self.form.add_error('min_price', "Minimum price must be greater than or equal to 0.00.")
            return False

        if max_p is not None and max_p < 0:
            self.form.add_error('max_price', "Maximum price must be greater than or equal to 0.00.")
            return False

        if min_p is not None and max_p is not None and min_p > max_p:
            self.form.add_error('min_price', "Minimum price cannot be greater than maximum price.")
            return False

        return True

    def filter_category(self, queryset, name, value):
        cleaned = str(value).strip()
        # Support filtering by category slug, category UUID, or parent category slug
        return queryset.filter(
            Q(category__slug__iexact=cleaned) |
            Q(category__parent__slug__iexact=cleaned) |
            Q(category__id__iexact=cleaned)
        ).distinct()

    def filter_in_stock(self, queryset, name, value):
        if value is True:
            return queryset.filter(
                variants__is_active=True,
                variants__inventory__quantity__gt=0
            ).distinct()
        elif value is False:
            in_stock_ids = Product.objects.filter(
                variants__is_active=True,
                variants__inventory__quantity__gt=0
            ).values_list('id', flat=True)
            return queryset.exclude(id__in=in_stock_ids).distinct()
        return queryset

    def filter_is_active(self, queryset, name, value):
        request = getattr(self, 'request', None)
        # Staff can filter both active and inactive; public always restricted to active
        if request and getattr(request.user, 'is_staff', False):
            return queryset.filter(is_active=value)
        return queryset.filter(is_active=True)

    def filter_color(self, queryset, name, value):
        return queryset.filter(
            variants__color__iexact=str(value).strip(),
            variants__is_active=True
        ).distinct()

    def filter_size(self, queryset, name, value):
        return queryset.filter(
            variants__size__iexact=str(value).strip(),
            variants__is_active=True
        ).distinct()
