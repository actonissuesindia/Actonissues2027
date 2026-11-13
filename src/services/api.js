import axios from 'axios';

// Same-origin '/api' works in production (Express serves the SPA) and in dev
// (Vite proxies '/api' to the Express server). withCredentials sends the session cookie.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Auto-translated content (see services/translationService.js) is served by
// the backend keyed off a ?lang= query param — reading localStorage
// directly here (the same key src/context/LanguageContext.jsx reads on
// startup) rather than via React context, since this is a plain module,
// not a component. Scoped to just the endpoints that actually have
// translations to serve; every other request is unaffected. Issues don't
// need a ?lang= for an English-language viewer (the backend already
// defaults missing ?lang= to 'en' — see issueController.js's applyLang) —
// this still has to match /issues so a *non*-English viewer's choice gets
// sent through.
api.interceptors.request.use((config) => {
  if (/^\/(articles|page-blocks|issues)(\/|$|\?)/.test(config.url || '')) {
    const lang = localStorage.getItem('aoi-language');
    if (lang && lang !== 'en') config.params = { ...config.params, lang };
  }
  return config;
});

// The backend independently expires a session after an hour of inactivity
// (middleware/auth.js), regardless of what the frontend's own idle timer
// is doing — this surfaces that case too (e.g. a background tab whose JS
// timers got throttled) so AuthContext can clear `user` and let
// ProtectedRoute redirect to /login, instead of the app silently sitting
// on a dead session until the next full page reload.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && err.response.data?.idleTimeout) {
      window.dispatchEvent(new Event('auth:idle-timeout'));
    }
    return Promise.reject(err);
  }
);

export default api;
