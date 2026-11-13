const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server');
const errorPages = require('../services/errorPages');

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

describe('Error pages', () => {
  it('knows every route the React app has', () => {
    // The server 404s any page path not in SPA_ROUTES, so a route added to
    // AppRoutes.jsx but not there would 404 on a direct visit or refresh.
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'AppRoutes.jsx'), 'utf8');
    const routes = [...source.matchAll(/path="([^"]+)"/g)].map(m => m[1]).filter(p => p !== '*');
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) {
      const sample = route.replace(/:[^/]+/g, 'abc123');
      expect(errorPages.isSpaRoute(sample), `${route} is missing from SPA_ROUTES in services/errorPages.js`).toBe(true);
    }
  });

  it('does not treat unknown paths as pages', () => {
    expect(errorPages.isSpaRoute('/no-such-page')).toBe(false);
    expect(errorPages.isSpaRoute('/issues')).toBe(false);
    expect(errorPages.isSpaRoute('/issues/1/2')).toBe(false);
    expect(errorPages.isSpaRoute('/Feed/')).toBe(true);
  });

  it('renders a page for every listed code, and a fallback for others', () => {
    for (const code of [...errorPages.ERROR_CODES, 418, 599]) {
      const html = errorPages.renderErrorPage(code);
      expect(html).toContain(`>${code}<`);
      expect(html).toContain('Bunny Bubbles');
      expect(html).not.toMatch(/{{\w+}}/);
    }
  });

  it('shows a browser a real 404 page for an unknown URL', async () => {
    const res = await request(app).get('/definitely-not-a-page').set('Accept', HTML);
    expect(res.status).toBe(404);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('Page not found');
  });

  it('keeps API errors as JSON', async () => {
    const res = await request(app).get('/api/definitely-not-an-endpoint').set('Accept', HTML);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('renders the maintenance page with the shared game and escapes input', () => {
    const html = errorPages.renderMaintenancePage({ message: '<b>hi</b>', contactEmail: 'a@b.co' });
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(html).toContain('mailto:a@b.co');
    expect(html).toContain('While you wait: Bunny Bubbles');
    expect(html).not.toMatch(/{{\w+}}/);
  });
});
