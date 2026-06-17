from django.test import TestCase
from datetime import datetime, timezone, timedelta
from trips.services.hos_calculator import HOSCalculator

class HOSCalculatorTestCase(TestCase):
    def setUp(self):
        self.start_time = datetime(2026, 6, 18, 6, 0, 0, tzinfo=timezone.utc)
        self.start_location = {"name": "Chicago, IL", "lat": 41.8781, "lon": -87.6298}
        self.destination = {"name": "Dallas, TX", "lat": 32.7767, "lon": -96.7970}

    def test_initial_gap_prepending(self):
        """Test that a gap before the trip start is padded with off-duty time."""
        calc = HOSCalculator(self.start_time, cycle_hours_used=0.0, start_location=self.start_location)
        self.assertEqual(len(calc.events), 1)
        self.assertEqual(calc.events[0]["duty_status"], "off_duty")
        self.assertEqual(calc.events[0]["duration_hours"], 6.0)
        self.assertEqual(calc.events[0]["start_time"], "2026-06-18T00:00:00+00:00")
        self.assertEqual(calc.events[0]["end_time"], "2026-06-18T06:00:00+00:00")

    def test_midnight_splitting(self):
        """Test that an event crossing midnight is correctly split."""
        calc = HOSCalculator(self.start_time, cycle_hours_used=0.0, start_location=self.start_location)
        # Add a 10-hour rest at 22:00
        calc.current_time = datetime(2026, 6, 18, 22, 0, 0, tzinfo=timezone.utc)
        calc._do_rest(self.start_location, hours=10.0)
        
        # The events list will contain:
        # 0. Initial gap (6h)
        # 1. Rest chunk 1 (22:00 to 00:00 on Day 1 - 2h)
        # 2. Rest chunk 2 (00:00 to 08:00 on Day 2 - 8h)
        self.assertEqual(len(calc.events), 3)
        
        self.assertEqual(calc.events[1]["day"], 1)
        self.assertEqual(calc.events[1]["duration_hours"], 2.0)
        self.assertEqual(calc.events[1]["end_time"], "2026-06-19T00:00:00+00:00")
        
        self.assertEqual(calc.events[2]["day"], 2)
        self.assertEqual(calc.events[2]["duration_hours"], 8.0)
        self.assertEqual(calc.events[2]["start_time"], "2026-06-19T00:00:00+00:00")
        self.assertEqual(calc.events[2]["end_time"], "2026-06-19T08:00:00+00:00")

    def test_daily_logs_continuity_and_24h(self):
        """Test that build_daily_logs pads all days to exactly 24 hours."""
        calc = HOSCalculator(self.start_time, cycle_hours_used=0.0, start_location=self.start_location)
        calc.add_stop("pre_trip_inspection", self.start_location, 0.5, "Pre-trip inspection")
        calc.drive_segment(110.0, 2.0, self.start_location, self.destination) # 2 hours driving
        
        daily_logs = calc.build_daily_logs()
        self.assertEqual(len(daily_logs), 1)
        
        log = daily_logs[0]
        self.assertEqual(log["date"], "2026-06-18")
        
        # Verify total hours sum to exactly 24.0
        total_hours = log["total_driving_hours"] + log["total_on_duty_hours"] + log["total_off_duty_hours"]
        self.assertEqual(total_hours, 24.0)
        
        # Check start and end of events
        self.assertEqual(log["events"][0]["start_time"], "2026-06-18T00:00:00+00:00")
        self.assertEqual(log["events"][-1]["end_time"], "2026-06-19T00:00:00+00:00")

    def test_break_insertion(self):
        """Test that a mandatory 30-min break is inserted after 8 hours of cumulative driving."""
        calc = HOSCalculator(self.start_time, cycle_hours_used=0.0, start_location=self.start_location)
        calc.add_stop("pre_trip_inspection", self.start_location, 0.5, "Pre-trip")
        
        # Drive 9 hours (should insert break at hour 8)
        calc.drive_segment(495.0, 9.0, self.start_location, self.destination)
        
        # Check events
        break_events = [e for e in calc.events if e["event_type"] == "rest_break"]
        self.assertEqual(len(break_events), 1)
        self.assertEqual(break_events[0]["duration_hours"], 0.5)

    def test_cycle_restart(self):
        """Test that hitting 70 cycle hours triggers a 34-hour restart."""
        # Start with 68 hours already used
        calc = HOSCalculator(self.start_time, cycle_hours_used=68.0, start_location=self.start_location)
        calc.add_stop("pre_trip_inspection", self.start_location, 0.5, "Pre-trip") # now 68.5 hours
        
        # Drive 3 hours. Since max limit is 70, it should trigger 34-hour restart after driving 1.5 hours
        calc.drive_segment(165.0, 3.0, self.start_location, self.destination)
        
        restart_events = [e for e in calc.events if e["event_type"] == "cycle_restart"]
        self.assertEqual(sum(e["duration_hours"] for e in restart_events), 34.0)
        self.assertEqual(restart_events[-1]["cycle_hours_after_event"], 0.0)

    def test_fuel_stop_insertion(self):
        """Test that fuel stops are inserted every <= 1,000 miles."""
        calc = HOSCalculator(self.start_time, cycle_hours_used=0.0, start_location=self.start_location)
        # Drive 1,200 miles (should insert fuel stop at or before 1,000 miles)
        # Average speed = 60 mph, duration = 20 hours
        calc.drive_segment(1200.0, 20.0, self.start_location, self.destination)
        
        fuel_events = [e for e in calc.events if e["event_type"] == "fuel_stop"]
        self.assertEqual(len(fuel_events), 1)
        self.assertEqual(fuel_events[0]["duration_hours"], 0.5)
