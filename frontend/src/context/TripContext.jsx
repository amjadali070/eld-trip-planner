import { createContext, useContext, useState } from 'react';

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('form'); // 'form' | 'results'

  return (
    <TripContext.Provider value={{
      tripData, setTripData,
      loading, setLoading,
      error, setError,
      currentView, setCurrentView,
    }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrip = () => useContext(TripContext);
