import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('lf_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Support { token: "..." }, { accessToken: "..." }, or a raw string token
      const token = parsed?.token || parsed?.accessToken || (typeof parsed === 'string' ? parsed : null);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.error('Error attaching auth token to request:', err);
  }
  return config;
});

// If the admin suspends an account mid-session, every protected call returns 403 + isSuspended.
// Log the user out and send them to the login page with the reason.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.isSuspended) {
      try {
        localStorage.removeItem('lf_user');
        sessionStorage.setItem('lf_notice', error.response.data.message || 'Your account is suspended.');
      } catch (err) {
        console.error('Failed to clear suspended session:', err);
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;