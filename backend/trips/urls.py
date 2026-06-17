from django.urls import path
from .views import TripPlanView, TripDetailView, GeocodeView

urlpatterns = [
    path('trip/plan', TripPlanView.as_view(), name='trip-plan'),
    path('trip/<uuid:trip_id>', TripDetailView.as_view(), name='trip-detail'),
    path('geocode', GeocodeView.as_view(), name='geocode'),
]
