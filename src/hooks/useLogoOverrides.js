import { useEffect, useState } from 'react';
import api from '../services/api';

// Public, unauthenticated — TopNav and Footer both call this independently
// (rather than sharing a context) to read whatever header/footer logo the
// Super Admin has uploaded via the Admin dashboard. A blank value means "no
// override", so callers fall back to their own bundled default image.
export default function useLogoOverrides() {
  const [logos, setLogos] = useState({ header: '', footer: '' });
  useEffect(() => {
    api.get('/logo')
      .then(res => setLogos({ header: res.data.header || '', footer: res.data.footer || '' }))
      .catch(() => {});
  }, []);
  return logos;
}
