import uuid
from django.db import models


class TripPlan(models.Model):
    trip_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Inputs
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used = models.FloatField()

    # Computed summary
    total_distance_miles = models.FloatField(default=0)
    total_duration_hours = models.FloatField(default=0)
    estimated_arrival = models.DateTimeField(null=True, blank=True)

    # Full JSON results
    route_geometry = models.JSONField(default=dict)
    stops = models.JSONField(default=list)
    events = models.JSONField(default=list)
    daily_logs = models.JSONField(default=list)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.current_location} → {self.dropoff_location} ({self.trip_id})"
