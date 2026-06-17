import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

export const planTrip = async (data) => {
  const response = await api.post('/trip/plan', data);
  return response.data;
};

export const getTrip = async (tripId) => {
  const response = await api.get(`/trip/${tripId}`);
  return response.data;
};

export const geocodeLocation = async (query) => {
  const response = await api.post('/geocode', { query });
  return response.data;
};
