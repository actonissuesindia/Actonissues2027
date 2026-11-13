import { useEffect, useRef, useState } from 'react';
import loadGooglePlaces from '../../utils/loadGooglePlaces';

// Vite bakes VITE_* vars in at build time, which works for local dev but is
// always empty in the production Docker image (the build runs before Cloud
// Run's env vars exist — see server.js's ANALYTICS_HEAD comment for the full
// explanation). server.js works around that by injecting the same value as
// `window.__GEOAPIFY_KEY__` into the page at request time in production.
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY || (typeof window !== 'undefined' && window.__GEOAPIFY_KEY__) || '';

// Still used for reverse-geocoding (turning a lat/lng from "Use my location"
// or the map picker back into address fields) — only the typed-address
// search below moved to Google Places. Geoapify's address components
// roughly line up with Nominatim's (which this originally replaced):
// `county` is the Indian district, `suburb`/`district` are the more local
// mandal-ish area.
export function parseGeoapifyResult(result) {
  return {
    address: result.formatted,
    city: result.city || result.county || '',
    district: result.county || '',
    mandal: result.suburb || result.district || '',
    state: result.state || '',
    lat: Number(result.lat),
    lng: Number(result.lon)
  };
}

export async function reverseGeocode(lat, lng) {
  const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?format=json&lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_KEY}`);
  const data = await res.json();
  const result = data?.results?.[0];
  if (!result) return null;
  return parseGeoapifyResult(result);
}

// Google's addressComponents don't line up 1:1 with Geoapify's field names,
// but applyLocation() in PostIssueModal.jsx expects this exact shape
// (address/city/district/mandal/state/lat/lng) regardless of which provider
// found the address — administrative_area_level_2 is the closest Google
// equivalent to an Indian district, _level_3/sublocality to a mandal/taluk.
function parseGooglePlace(place) {
  const comps = place.addressComponents || [];
  const get = (type) => comps.find(c => c.types.includes(type))?.longText || '';
  return {
    address: place.formattedAddress || '',
    city: get('locality') || get('administrative_area_level_2') || '',
    district: get('administrative_area_level_2') || '',
    mandal: get('administrative_area_level_3') || get('sublocality_level_1') || get('sublocality') || '',
    state: get('administrative_area_level_1') || '',
    lat: place.location ? place.location.lat() : undefined,
    lng: place.location ? place.location.lng() : undefined
  };
}

// Address search (Google Places) — as the user types, shows real matching
// addresses; picking one hands back the parsed address components to
// auto-fill the rest of the location fields. "Use my location" and the map
// pin still resolve through Geoapify's reverseGeocode above, unchanged.
// Uses the AutocompleteSuggestion/Place classes (not the older
// AutocompleteService/PlacesService) — Google blocks the older ones outright
// for API keys created after March 2025 ("ApiTargetBlockedMapError").
export default function AddressAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // Loading the Google library is a network round-trip — typing can easily
  // finish before it resolves. A plain ref wouldn't re-trigger the search
  // effect once loading finishes (refs don't cause re-renders), so this has
  // to be state, in that effect's dependency array below, to retry once
  // ready flips true.
  const [ready, setReady] = useState(false);
  const boxRef = useRef(null);
  const skipNextFetch = useRef(false);
  const placesLibRef = useRef(null);
  const sessionTokenRef = useRef(null);

  useEffect(() => {
    loadGooglePlaces()
      .then((places) => {
        placesLibRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => setUnavailable(true));
  }, []);

  useEffect(() => {
    if (skipNextFetch.current) { skipNextFetch.current = false; return; }
    if (!ready || !value || value.trim().length < 4) { setSuggestions([]); return; }
    const handle = setTimeout(() => {
      setLoading(true);
      placesLibRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value.trim(),
        includedRegionCodes: ['in'],
        sessionToken: sessionTokenRef.current
      }).then(({ suggestions: results }) => {
        setSuggestions((results || []).filter(s => s.placePrediction));
      }).catch(() => setSuggestions([])).finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(handle);
  }, [value, ready]);

  useEffect(() => {
    const onClickAway = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const pick = async (suggestion) => {
    skipNextFetch.current = true;
    setOpen(false);
    setSuggestions([]);
    const place = suggestion.placePrediction.toPlace();
    try {
      await place.fetchFields({ fields: ['formattedAddress', 'addressComponents', 'location'] });
    } catch {
      return;
    }
    // A new session token per pick (not per keystroke) is what actually
    // bounds Google's per-session Autocomplete billing.
    sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
    onSelect(parseGooglePlace(place));
  };

  return (
    <div className="position-relative" ref={boxRef}>
      <input
        className="form-control mb-1"
        placeholder={unavailable ? 'Address search unavailable — type it below' : 'Start typing an address…'}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="dropdown-menu d-block w-100 shadow-sm" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {loading && <div className="dropdown-item-text small text-muted">Searching…</div>}
          {!loading && suggestions.map((s) => (
            <button type="button" key={s.placePrediction.placeId} className="dropdown-item small" onClick={() => pick(s)}>
              {s.placePrediction.text.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
