import { useEffect, useRef, useState } from 'react';
import loadGooglePlaces from '../../utils/loadGooglePlaces';

const RADIUS_OPTIONS = [1, 5, 10, 25, 50];

// Google-powered replacement for the old text-only LocationSearch — picking
// a suggestion here hands back a precise lat/lng (not just a place name), so
// Feed.jsx can filter issues by actual distance instead of substring match.
// Uses the AutocompleteSuggestion/Place classes (not the older
// AutocompleteService/PlacesService) — Google blocks the older ones outright
// for API keys created after March 2025 ("ApiTargetBlockedMapError").
export default function GooglePlacesLocationSearch({ value, radiusKm, onSelect, onRadiusChange, onClear }) {
  const [input, setInput] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const boxRef = useRef(null);
  const placesLibRef = useRef(null);
  const sessionTokenRef = useRef(null);

  useEffect(() => { setInput(value || ''); }, [value]);

  useEffect(() => {
    loadGooglePlaces()
      .then((places) => {
        placesLibRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!ready || !input.trim() || input === value) { setSuggestions([]); return; }
    const handle = setTimeout(() => {
      placesLibRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: input.trim(),
        includedRegionCodes: ['in'],
        sessionToken: sessionTokenRef.current
      }).then(({ suggestions: results }) => {
        setSuggestions((results || []).filter(s => s.placePrediction));
      }).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [input, value, ready]);

  useEffect(() => {
    const onClickAway = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const pick = async (suggestion) => {
    setOpen(false);
    const prediction = suggestion.placePrediction;
    const place = prediction.toPlace();
    try {
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
    } catch {
      return;
    }
    // Starting a new session token per pick, not per keystroke, is what
    // actually bounds Google's per-session Autocomplete billing.
    sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
    if (!place.location) return;
    const label = place.formattedAddress || prediction.text?.text || '';
    setInput(label);
    onSelect({ label, lat: place.location.lat(), lng: place.location.lng() });
  };

  const clear = () => {
    setInput('');
    setSuggestions([]);
    onClear();
  };

  return (
    <div className="position-relative" ref={boxRef} style={{ minWidth: 220 }}>
      <i className="bi bi-geo-alt position-absolute top-50 translate-middle-y ms-3 text-muted"></i>
      <input
        className="form-control ps-5 rounded-pill"
        placeholder={error ? 'Location search unavailable' : 'Search for an address…'}
        value={input}
        disabled={error}
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {value && (
        <button type="button" className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted pe-3"
          onClick={clear} title="Clear location filter">
          <i className="bi bi-x-lg"></i>
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div className="dropdown-menu d-block w-100 shadow-sm mt-1" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {suggestions.map((s) => (
            <button type="button" key={s.placePrediction.placeId} className="dropdown-item small"
              onClick={() => pick(s)}>
              {s.placePrediction.text.text}
            </button>
          ))}
        </div>
      )}
      {value && (
        <select
          className="form-select form-select-sm rounded-pill mt-2"
          value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))}
          title="Search radius"
        >
          {RADIUS_OPTIONS.map(km => <option key={km} value={km}>Within {km} km</option>)}
        </select>
      )}
    </div>
  );
}
