import { useState } from 'react';
import { ArrowLeft, Truck, Clock, MapPin, Route, Calendar, AlertTriangle } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import MapView from '../MapView/index.jsx';
import LogSheetViewer from '../LogSheetViewer/index.jsx';

function SummaryCard({ icon: Icon, label, value, color = 'text-amber-400' }) {
  return (
    <div className="bg-navy-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3"
         style={{background:'rgba(26,46,74,0.7)'}}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('400', '900/40')}`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-sans">{label}</div>
        <div className={`font-mono font-bold text-base ${color}`}>{value}</div>
      </div>
    </div>
  );
}

export default function TripResults() {
  const { tripData, setCurrentView } = useTrip();
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' | 'timeline'

  if (!tripData) return null;

  const { route, stops, daily_logs, total_distance_miles, total_duration_hours, estimated_arrival } = tripData;
  const totalDays = daily_logs?.length || 0;
  const totalMiles = Math.round(total_distance_miles || 0);
  const drivingHours = daily_logs?.reduce((s, d) => s + d.total_driving_hours, 0).toFixed(1) || 0;

  const arrivalDate = estimated_arrival ? new Date(estimated_arrival).toUTCString().slice(0, 25) : 'N/A';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-navy-900 border-b border-slate-800 px-4 py-3"
           style={{background:'rgba(10,22,40,0.95)', backdropFilter:'blur(12px)'}}>
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('form')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft size={16} /> New Trip
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-amber-400" />
              <span className="font-mono text-sm text-white font-semibold">
                {route?.waypoints?.[0]?.name} → {route?.waypoints?.[route.waypoints.length - 1]?.name}
              </span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-400">
              <span className="text-amber-400 font-bold">{totalMiles.toLocaleString()}</span> mi
            </span>
            <span className="text-slate-400">
              <span className="text-emerald-400 font-bold">{drivingHours}</span> driving hrs
            </span>
            <span className="text-slate-400">
              <span className="text-purple-400 font-bold">{totalDays}</span> day{totalDays !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={Route} label="Total Distance" value={`${totalMiles.toLocaleString()} mi`} color="text-amber-400" />
          <SummaryCard icon={Clock} label="Driving Time" value={`${drivingHours} hrs`} color="text-emerald-400" />
          <SummaryCard icon={Calendar} label="Trip Days" value={`${totalDays} day${totalDays !== 1 ? 's' : ''}`} color="text-purple-400" />
          <SummaryCard icon={MapPin} label="ETA (UTC)" value={arrivalDate.slice(5, 22)} color="text-blue-400" />
        </div>
      </div>

      {/* Tab/Layout Navigation */}
      <div className="px-4 pt-4">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex gap-1 bg-slate-800 p-1 rounded-xl w-fit border border-slate-700">
            {/* Log Sheets Tab */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'logs'
                  ? 'bg-amber-500 text-navy-900 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Log Sheets
            </button>

            {/* Timeline Tab */}
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'timeline'
                  ? 'bg-amber-500 text-navy-900 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⏱️ Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 pb-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Map (Always visible on desktop/mobile) */}
            <div className="lg:col-span-4 xl:col-span-4 h-[450px] lg:h-[calc(100vh-220px)] lg:sticky lg:top-[75px]">
              <MapView tripData={tripData} />
            </div>

            {/* Right Column: Logs / Timeline */}
            <div className="lg:col-span-8 xl:col-span-8 space-y-6">
              
              {/* Log Sheets Content */}
              {activeTab === 'logs' && (
                <LogSheetViewer tripData={tripData} />
              )}

              {/* Timeline Content */}
              {activeTab === 'timeline' && (
                <div className="bg-navy-800 border border-slate-700 rounded-2xl p-6"
                     style={{background:'rgba(26,46,74,0.7)'}}>
                  <h3 className="font-mono text-lg font-semibold text-white mb-4">Full Trip Timeline</h3>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {(stops || []).map((stop, i) => {
                      const typeMap = {
                        pre_trip_inspection: { emoji: '🔧', color: 'border-emerald-500', label: 'Pre-trip Inspection' },
                        pickup: { emoji: '📦', color: 'border-blue-500', label: 'Pickup' },
                        dropoff: { emoji: '🏁', color: 'border-red-500', label: 'Dropoff' },
                        fuel_stop: { emoji: '⛽', color: 'border-amber-500', label: 'Fuel Stop' },
                        rest_break: { emoji: '☕', color: 'border-purple-500', label: '30-min Break' },
                        rest: { emoji: '🛏️', color: 'border-indigo-500', label: '10-hr Rest' },
                        cycle_restart: { emoji: '🔄', color: 'border-pink-500', label: '34-hr Restart' },
                      };
                      const t = typeMap[stop.stop_type] || { emoji: '📍', color: 'border-slate-500', label: stop.stop_type };
                      const arrive = new Date(stop.arrive_time).toUTCString().slice(5, 22);
                      const depart = new Date(stop.depart_time).toUTCString().slice(5, 22);
                      return (
                        <div key={i} className={`flex items-start gap-4 border-l-2 pl-4 py-2 ${t.color}`}>
                          <span className="text-xl shrink-0">{t.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm">{t.label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              📍 {stop.location?.name} &nbsp;|&nbsp; Day {stop.day}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-1">
                              {arrive} → {depart}
                              <span className="ml-2 text-amber-400">
                                ({(stop.duration_hours * 60).toFixed(0)} min)
                              </span>
                            </div>
                          </div>
                          {stop.notes && (
                            <div className="text-xs text-slate-500 italic shrink-0 max-w-[200px] text-right">
                              {stop.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
