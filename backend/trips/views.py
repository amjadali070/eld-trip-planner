from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import TripPlanRequestSerializer, TripPlanResponseSerializer
from .models import TripPlan
from .services.trip_planner import plan_trip


class TripPlanView(APIView):
    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            result = plan_trip(
                current_location=data['current_location'],
                pickup_location=data['pickup_location'],
                dropoff_location=data['dropoff_location'],
                current_cycle_used=data['current_cycle_used'],
                start_time=data.get('start_time'),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Trip planning failed: {str(e)}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Save to DB
        trip = TripPlan.objects.create(
            current_location=data['current_location'],
            pickup_location=data['pickup_location'],
            dropoff_location=data['dropoff_location'],
            current_cycle_used=data['current_cycle_used'],
            total_distance_miles=result['total_distance_miles'],
            total_duration_hours=result['total_duration_hours'],
            estimated_arrival=result['estimated_arrival'],
            route_geometry=result['route']['geometry'],
            stops=result['stops'],
            events=result['events'],
            daily_logs=result['daily_logs'],
        )

        return Response({
            "trip_id": str(trip.trip_id),
            **result,
        }, status=status.HTTP_201_CREATED)


class TripDetailView(APIView):
    def get(self, request, trip_id):
        try:
            trip = TripPlan.objects.get(trip_id=trip_id)
        except TripPlan.DoesNotExist:
            return Response({"error": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = TripPlanResponseSerializer(trip)
        return Response(serializer.data)


class GeocodeView(APIView):
    def post(self, request):
        query = request.data.get("query", "").strip()
        if not query:
            return Response({"error": "query is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from .services.geocoding import geocode
            result = geocode(query)
            return Response(result)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
