from rest_framework import serializers

class HealthCheckSerializer(serializers.Serializer):
    """
    Serializer representing system health check response data.
    """
    status = serializers.CharField(max_length=50)
    database = serializers.CharField(max_length=100)
    engine = serializers.CharField(max_length=50, required=False)
    version = serializers.CharField(max_length=20)

