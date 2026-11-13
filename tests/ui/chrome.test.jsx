import { screen, waitFor } from '@testing-library/react';
import TopNav from '../../src/components/layout/TopNav';
import Footer from '../../src/components/layout/Footer';
import { renderInApp } from './renderShell';

// The header and footer appear on every page, so an error in either takes the
// whole site down — which is what happened: both called a helper neither
// imported, the build passed, and every visitor got a blank page.
//
// The first version of these tests passed against that exact bug. They waited
// for "a link, any link", which the logo satisfies on the first render, before
// the menu data had arrived and the broken branch had run. So every test here
// now waits for something that only exists *after* the stored menu is loaded
// and filtered — the work that was broken.
describe('The site chrome', () => {
  it('renders the header with the stored menu', async () => {
    renderInApp(<TopNav />);
    // Comes from the mocked page-blocks response, so seeing it proves the
    // component got past fetching, filtering and rendering that list.
    expect(await screen.findByText('Trending')).toBeTruthy();
    expect(screen.getByText('Issues')).toBeTruthy();
  });

  it('renders the footer with its stored menu', async () => {
    renderInApp(<Footer />);
    expect(await screen.findByText('About Us')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
  });

  it('renders both together, as every page does', async () => {
    renderInApp(<><TopNav /><Footer /></>);
    expect(await screen.findByText('Trending')).toBeTruthy();
    expect(await screen.findByText('About Us')).toBeTruthy();
  });

  // The feature those helpers exist for, asserted directly.
  describe('links to pages that no longer exist', () => {
    it('are left out of the header', async () => {
      renderInApp(<TopNav />);
      await screen.findByText('Trending');
      expect(screen.queryByText('Founder')).toBeNull();
    });

    it('are left out of the footer', async () => {
      renderInApp(<Footer />);
      await screen.findByText('About Us');
      expect(screen.queryByText("Founder's Message")).toBeNull();
    });

    it('do not take the rest of the menu with them', async () => {
      renderInApp(<TopNav />);
      await screen.findByText('Trending');
      // Everything except the retired one survives.
      for (const label of ['Issues', 'Trending', 'About']) {
        expect(screen.getByText(label)).toBeTruthy();
      }
    });
  });
});
