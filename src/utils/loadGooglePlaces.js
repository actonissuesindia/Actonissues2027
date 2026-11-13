// Vite bakes VITE_* vars in at build time, which is always empty in the
// production Docker image (the build runs before Cloud Run's env vars
// exist — see server.js's ANALYTICS_HEAD comment). Worked around the same
// way as VITE_GEOAPIFY_API_KEY: server.js injects the same value as
// `window.__GOOGLE_PLACES_KEY__` into the page at request time in production.
const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
  || (typeof window !== 'undefined' && window.__GOOGLE_PLACES_KEY__)
  || '';

let loadPromise = null;

// As of March 2025 the classic google.maps.places.AutocompleteService /
// PlacesService classes are blocked outright for new API keys/projects
// ("ApiTargetBlockedMapError", confirmed live) — Google requires the
// replacement AutocompleteSuggestion/Place classes instead, which only
// exist behind google.maps.importLibrary(). That function isn't part of
// the plain script response though — it's set up once Google's own script
// finishes its async init, which a &loading=async script only signals via
// its `callback` URL param, not the browser's native script.onload (that
// fires on the small bootstrap chunk, well before importLibrary is ready —
// confirmed live as "importLibrary is not a function" when relied on).
export default function loadGooglePlaces() {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    if (window.google?.maps?.importLibrary) {
      window.google.maps.importLibrary('places').then(resolve, reject);
      return;
    }
    if (!GOOGLE_PLACES_KEY) return reject(new Error('Missing VITE_GOOGLE_PLACES_API_KEY'));

    const callbackName = `__googleMapsReady_${Math.random().toString(36).slice(2)}`;
    window[callbackName] = () => {
      delete window[callbackName];
      window.google.maps.importLibrary('places').then(resolve, reject);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_PLACES_KEY)}&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
