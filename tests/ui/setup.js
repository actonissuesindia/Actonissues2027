import { afterEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Browser-side test setup. No database, on purpose — see vitest.config.mjs.

afterEach(() => cleanup());

// jsdom implements most of a browser but not the handful of APIs this app
// reaches for. Each stub below stands in for something jsdom omits; without
// them a component fails for a reason that has nothing to do with its own
// correctness, which teaches people to distrust the suite.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false
  });
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
}

window.scrollTo = window.scrollTo || (() => {});
if (!window.crypto?.randomUUID) {
  window.crypto = { ...window.crypto, randomUUID: () => 'test-uuid' };
}

// A render that throws is the failure these tests exist to catch, and React
// logs such errors through console.error before rethrowing. Turning that into
// a hard failure means a component cannot quietly render a broken subtree and
// still pass — while a genuinely expected error can be allowed per test with
// expectConsoleError().
const IGNORED = [
  // React Router emits these for opt-in v7 behaviours; they are notices, not defects.
  /React Router Future Flag/,
  /not wrapped in act/
];

let allowedErrors = [];
export function expectConsoleError(pattern) { allowedErrors.push(pattern); }

const realError = console.error;
console.error = (...args) => {
  const text = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ');
  if (IGNORED.some(p => p.test(text))) return;
  if (allowedErrors.some(p => p.test(text))) return;
  realError(...args);
  throw new Error(`Unexpected console.error during render:\n${text}`);
};

afterEach(() => { allowedErrors = []; });

expect.extend({});

// Every page reaches for the API on mount. Left unmocked, each test would
// depend on network behaviour and on axios's own error handling; mocked here
// once, every component gets a well-formed empty response and the test is
// about the component.
vi.mock('../../src/services/api', () => {
  const empty = { data: {} };
  // Menus come back with rows in them, as they do in production. An empty
  // list here would be worse than useless: the components fall back to
  // built-in defaults when a menu is empty, so the code that reads stored
  // blocks would never run and a test could pass while that code was broken.
  // It included a link to a retired page for the same reason — the filtering
  // is only exercised if there is something to filter.
  const MENU_BLOCKS = {
    'topnav-links': [
      { _id: 'b1', config: { label: 'Issues', href: '/feed' } },
      { _id: 'b2', config: { label: 'Trending', href: '/feed?filter=hot' } },
      { _id: 'b3', config: { label: 'Founder', href: '/founders-message' } },
      { _id: 'b4', config: { label: 'About', href: '/about' } }
    ],
    'footer-platform': [
      { _id: 'f1', config: { label: 'About Us', href: '/about' } },
      { _id: 'f2', config: { label: "Founder's Message", href: '/founders-message' } }
    ],
    'footer-account': [{ _id: 'f3', config: { label: 'Log in', href: '/login' } }],
    'footer-legal': [{ _id: 'f4', config: { label: 'Privacy Policy', href: '/privacy' } }]
  };

  const api = {
    get: vi.fn(async (url, config) => {
      // Shapes the components actually destructure. Anything else gets {}.
      if (url.includes('page-blocks')) {
        return { data: { blocks: MENU_BLOCKS[config?.params?.page] || [] } };
      }
      if (url.includes('/issues/stats')) return { data: { stats: { total: 0, open: 0, inProgress: 0, resolved: 0, escalated: 0 } } };
      if (url.includes('/issues/category-counts')) return { data: { categories: [] } };
      if (url.includes('/issues/top-reporters')) return { data: { reporters: [] } };
      if (url.includes('/issues/featured')) return { data: { issues: [] } };
      if (url.includes('/issues/meta')) return { data: { statuses: [], categories: [], topicHierarchy: {}, states: [] } };
      if (url.includes('/issues')) return { data: { issues: [], total: 0 } };
      if (url.includes('/hero-quotes')) return { data: { quotes: [], eyebrowText: '', descriptionText: '' } };
      if (url.includes('/notifications')) return { data: { notifications: [], unread: 0 } };
      if (url.includes('/announcements')) return { data: { announcements: [] } };
      if (url.includes('/logo')) return { data: {} };
      if (url.includes('/auth/me')) return { data: { user: null } };
      if (url.includes('/consent')) return { data: { purposes: [], consent: {}, needsReview: false } };
      return empty;
    }),
    post: vi.fn(async () => empty),
    patch: vi.fn(async () => empty),
    delete: vi.fn(async () => empty)
  };
  return { default: api, ...api };
});
