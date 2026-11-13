import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThemeProvider from '../../src/context/ThemeContext';
import LanguageProvider from '../../src/context/LanguageContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { ToastProvider } from '../../src/context/ToastContext';

// Renders a component inside the same providers the real app wraps it in.
//
// Without these, a page fails on a missing context rather than on anything
// true about the page — and a suite that fails for its own reasons is one
// people learn to ignore.
export function renderInApp(ui, { route = '/' } = {}) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default renderInApp;
