import { useState } from 'react';
import { MapPin, Navigation, Package, Clock, Truck, AlertCircle } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { planTrip } from '../../api/tripApi';

const getDefaultDepartureTimeString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  const tzoffset = tomorrow.getTimezoneOffset() * 60000;
  return new Date(tomorrow.getTime() - tzoffset).toISOString().slice(0, 16);
};

export default function TripPlannerForm() {
  const { setTripData, setLoading, setError, setCurrentView, loading, error } = useTrip();
  const [form, setForm] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    current_cycle_used: 0,
    start_time: getDefaultDepartureTimeString(),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'current_cycle_used' ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.current_location || !form.pickup_location || !form.dropoff_location) {
      setError('All location fields are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const submitData = { ...form };
      if (form.start_time) {
        submitData.start_time = new Date(form.start_time).toISOString();
      }
      const data = await planTrip(submitData);
      setTripData(data);
      setCurrentView('results');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Trip planning failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'current_location', label: 'Current Location', icon: Navigation, placeholder: 'e.g. Chicago, IL', color: 'text-green-400' },
    { name: 'pickup_location', label: 'Pickup Location', icon: Package, placeholder: 'e.g. St. Louis, MO', color: 'text-blue-400' },
    { name: 'dropoff_location', label: 'Dropoff Location', icon: MapPin, placeholder: 'e.g. Dallas, TX', color: 'text-red-400' },
  ];

  const examples = [
    { label: 'Short Haul', current: 'Chicago, IL', pickup: 'Indianapolis, IN', dropoff: 'Cincinnati, OH', cycle: 10 },
    { label: 'Mid Haul', current: 'Chicago, IL', pickup: 'St. Louis, MO', dropoff: 'Dallas, TX', cycle: 24 },
    { label: 'Long Haul', current: 'Los Angeles, CA', pickup: 'Phoenix, AZ', dropoff: 'Houston, TX', cycle: 35 },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
            <Truck size={26} className="text-navy-900" style={{color:'#0a1628'}} />
          </div>
          <h1 className="font-mono text-4xl font-bold text-white tracking-tight">
            ELD Trip Planner
          </h1>
        </div>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          HOS-compliant trip planning with automated log sheet generation.
          Powered by FMCSA 70hr/8-day property carrier rules.
        </p>
        <div className="flex gap-3 justify-center mt-4 flex-wrap">
          {['11-Hr Driving Limit', '14-Hr Window', '30-Min Break Rule', '70-Hr/8-Day Cycle'].map(tag => (
            <span key={tag} className="px-3 py-1 bg-navy-800 border border-slate-700 rounded-full text-xs text-amber-400 font-mono">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-2xl">
        <div className="bg-navy-800 border border-slate-700 rounded-2xl p-8 shadow-2xl"
             style={{background: 'rgba(26,46,74,0.9)', backdropFilter:'blur(12px)'}}>
          <h2 className="font-mono text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-amber-500 rounded-full inline-block"/>
            Enter Trip Details
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map(({ name, label, icon: Icon, placeholder, color }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <Icon size={14} className={color} />
                  {label}
                </label>
                <input
                  type="text"
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  required
                  className="w-full bg-navy-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors font-sans text-sm"
                  style={{background:'rgba(10,22,40,0.8)'}}
                />
              </div>
            ))}

            {/* Departure Time */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Clock size={14} className="text-blue-400" />
                Departure Time (Local)
              </label>
              <input
                type="datetime-local"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
                className="w-full bg-navy-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors font-sans text-sm"
                style={{background:'rgba(10,22,40,0.8)'}}
              />
            </div>

            {/* Cycle Hours */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Clock size={14} className="text-amber-400" />
                Current Cycle Used (Hours)
                <span className="ml-auto font-mono text-amber-400 text-base font-bold">
                  {form.current_cycle_used} / 70 hrs
                </span>
              </label>
              <input
                type="range"
                name="current_cycle_used"
                min="0"
                max="70"
                step="0.5"
                value={form.current_cycle_used}
                onChange={handleChange}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{accentColor:'#F59E0B'}}
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0 hrs (fresh)</span>
                <span>35 hrs</span>
                <span>70 hrs (limit)</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-900/30 border border-red-700 rounded-lg px-4 py-3">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 text-navy-900 font-mono font-bold text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
              style={{color:'#0a1628'}}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />
                  Planning Trip...
                </>
              ) : (
                <>
                  <Truck size={20} />
                  Generate Trip Plan & Log Sheets
                </>
              )}
            </button>
          </form>

          {/* Quick Examples */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-3 font-mono uppercase tracking-widest">Quick Examples</p>
            <div className="grid grid-cols-3 gap-2">
              {examples.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => setForm({
                    current_location: ex.current,
                    pickup_location: ex.pickup,
                    dropoff_location: ex.dropoff,
                    current_cycle_used: ex.cycle,
                    start_time: getDefaultDepartureTimeString(),
                  })}
                  className="py-2 px-3 bg-navy-900 border border-slate-700 hover:border-amber-500 rounded-lg text-xs text-slate-300 hover:text-amber-400 transition-colors text-left"
                  style={{background:'rgba(10,22,40,0.6)'}}
                >
                  <div className="font-mono font-semibold mb-1">{ex.label}</div>
                  <div className="text-slate-500 text-xs truncate">{ex.current} →</div>
                  <div className="text-slate-500 text-xs truncate">{ex.dropoff}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
