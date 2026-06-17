import { TripProvider, useTrip } from './context/TripContext';
import TripPlannerForm from './components/TripPlannerForm/index.jsx';
import TripResults from './components/TripResults/index.jsx';
import { Truck } from 'lucide-react';

function AppContent() {
  const { currentView } = useTrip();
  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, #0a1628 0%, #1A2E4A 50%, #0a1628 100%)'}}>
      <header className="border-b border-slate-800 px-6 py-3"
              style={{background:'rgba(10,22,40,0.8)', backdropFilter:'blur(8px)'}}>
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Truck size={18} style={{color:'#0a1628'}} />
          </div>
          <span className="font-mono font-bold text-white tracking-tight">ELD Trip Planner</span>
          <span className="text-xs text-slate-500 font-sans ml-2 hidden sm:block">
            FMCSA 70hr/8-day Property Carrier Rules
          </span>
          <div className="ml-auto">
            <span className="text-xs text-slate-600 font-mono">Spotter AI Assessment</span>
          </div>
        </div>
      </header>
      {currentView === 'form' && <TripPlannerForm />}
      {currentView === 'results' && <TripResults />}
    </div>
  );
}

export default function App() {
  return (
    <TripProvider>
      <AppContent />
    </TripProvider>
  );
}
