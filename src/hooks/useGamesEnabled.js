import { useEffect, useState } from 'react';
import api from '../services/api';

// Backed by the GAMES_ENABLED system setting (Admin Settings tab). Defaults
// to true while the request is in flight, so the Games tab/page doesn't
// flash hidden/blocked for a moment on every load.
export default function useGamesEnabled() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    api.get('/games/ludo/enabled')
      .then(res => setEnabled(res.data.enabled !== false))
      .catch(() => {});
  }, []);
  return enabled;
}
