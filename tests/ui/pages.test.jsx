import { screen } from '@testing-library/react';
import { renderInApp } from './renderShell';

import Home from '../../src/pages/Home/Home';
import Feed from '../../src/pages/Feed/Feed';
import Login from '../../src/pages/Login/Login';
import Register from '../../src/pages/Register/Register';
import Privacy from '../../src/pages/Privacy/Privacy';
import Terms from '../../src/pages/Terms/Terms';
import Legal from '../../src/pages/Legal/Legal';
import About from '../../src/pages/About/About';

// "Does this page render at all" — the claim that was false during the blank-
// page outage, and the one no test made.
//
// Each waits for something that only appears after the page's data has
// arrived, so the assertion cannot be satisfied by a first paint that later
// throws. That mistake was made once here already: the original version of
// these tests waited for "any link", which the logo satisfies immediately,
// and passed against the very bug they were written for.
describe('Every page a visitor can reach', () => {
  it('renders the home page', async () => {
    renderInApp(<Home />);
    expect(await screen.findByText(/Raise an issue/i, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('renders the issues feed', async () => {
    renderInApp(<Feed />, { route: '/feed' });
    // Present once the feed has loaded and decided it has nothing to show.
    expect(await screen.findByRole('button', { name: /raise/i }, { timeout: 5000 })).toBeTruthy();
  });

  it('renders the login page', async () => {
    renderInApp(<Login />, { route: '/login' });
    expect(await screen.findByText(/Welcome back/i)).toBeTruthy();
  });

  it('renders the registration page, including its consent boxes', async () => {
    renderInApp(<Register />, { route: '/register' });
    expect(await screen.findByText(/Join Act On Issues/i)).toBeTruthy();
    // The Terms agreement is required for an account to be created, so its
    // absence would be a compliance regression, not only a visual one.
    expect(screen.getByText(/Terms of Use/i)).toBeTruthy();
  });

  it('renders the privacy notice', async () => {
    renderInApp(<Privacy />, { route: '/privacy' });
    expect(await screen.findByRole('heading', { name: /Privacy Policy/i })).toBeTruthy();
  });

  it('renders the terms', async () => {
    renderInApp(<Terms />, { route: '/terms' });
    expect(await screen.findByText(/Terms of Use/i)).toBeTruthy();
  });

  it('renders the legal disclaimer', async () => {
    renderInApp(<Legal />, { route: '/legal' });
    expect(await screen.findByRole('heading', { level: 3 })).toBeTruthy();
  });

  it('renders the about page', async () => {
    renderInApp(<About />, { route: '/about' });
    expect(await screen.findByText(/About Act On Issues/i, {}, { timeout: 5000 })).toBeTruthy();
  });
});
