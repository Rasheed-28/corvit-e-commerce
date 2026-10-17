from django_filters.rest_framework import DjangoFilterBackend as BaseDjangoFilterBackend


class DjangoFilterBackend(BaseDjangoFilterBackend):
    """
    OpenAPI 3.0 compatible DjangoFilterBackend.
    Implements get_schema_operation_parameters to provide complete query parameter
    metadata to DRF AutoSchema and Swagger/ReDoc documentation.
    Strictly raises ValidationError on invalid filter parameters.
    """
    raise_exception = True

    def get_schema_operation_parameters(self, view):
        try:
            queryset = view.get_queryset()
        except Exception:
            queryset = getattr(view, 'queryset', None)

        filterset_class = self.get_filterset_class(view, queryset)
        if not filterset_class:
            return []

        parameters = []
        for field_name, filter_field in filterset_class.base_filters.items():
            schema_type = 'string'
            filter_type = type(filter_field).__name__.lower()
            if any(term in filter_type for term in ('number', 'decimal', 'float')):
                schema_type = 'number'
            elif 'int' in filter_type:
                schema_type = 'integer'
            elif 'bool' in filter_type:
                schema_type = 'boolean'

            param = {
                'name': field_name,
                'required': getattr(filter_field, 'extra', {}).get('required', False),
                'in': 'query',
                'description': str(getattr(filter_field, 'label', '') or field_name),
                'schema': {
                    'type': schema_type,
                },
            }
            parameters.append(param)
        return parameters
