import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [20.5937, 78.9629]; // India
const DEFAULT_ZOOM = 5;
const PIN_ZOOM = 16;

// A red-pin divIcon built from the same Bootstrap Icon used elsewhere in the
// app, so the picked location marker matches the app's visual language
// instead of Leaflet's default blue-and-gold marker image (which also has a
// well-known bundler asset-path problem under Vite/webpack).
const pinIcon = L.divIcon({
  className: 'map-pin-icon',
  html: '<i class="bi bi-geo-alt-fill"></i>',
  iconSize: [32, 32],
  iconAnchor: [16, 30]
});

// Free, no-API-key interactive map (OpenStreetMap tiles via Leaflet) for
// dropping/dragging a pin to pick a location. Pairs with the free Nominatim
// reverse-geocoding already used elsewhere in this form.
export default function LocationPickerMap({ lat, lng, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER,
      zoom: lat != null && lng != null ? PIN_ZOOM : DEFAULT_ZOOM,
      scrollWheelZoom: false
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    map.on('click', (e) => onPickRef.current(e.latlng.lat, e.latlng.lng));

    // Tapping to focus/scroll the modal shouldn't also zoom the map — only
    // enable scroll-zoom once the user has deliberately interacted with it.
    map.once('focus', () => map.scrollWheelZoom.enable());

    if (lat != null && lng != null) {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        onPickRef.current(pos.lat, pos.lng);
      });
    }

    // Leaflet sizes itself from the container's dimensions at init time; if
    // the modal's entrance transition is still animating, that size is
    // wrong. Re-measure once after mount so the map isn't cropped/offset.
    const resizeTimer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        onPickRef.current(pos.lat, pos.lng);
      });
    }
    map.setView([lat, lng], Math.max(map.getZoom(), PIN_ZOOM));
  }, [lat, lng]);

  return <div ref={containerRef} className="location-picker-map" />;
}
