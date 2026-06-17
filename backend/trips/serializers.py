from rest_framework import serializers
from .models import TripPlan


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False, allow_null=True)


class TripPlanResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripPlan
        fields = [
            'trip_id', 'created_at',
            'current_location', 'pickup_location', 'dropoff_location',
            'current_cycle_used', 'total_distance_miles', 'total_duration_hours',
            'estimated_arrival', 'route_geometry', 'stops', 'events', 'daily_logs',
        ]
