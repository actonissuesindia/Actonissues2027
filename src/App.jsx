import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ThemeProvider from './context/ThemeContext';
import LanguageProvider from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import AppRoutes from './routes/AppRoutes';
import ForcePasswordChangeModal from './components/common/ForcePasswordChangeModal';
import WelcomeBanner from './components/common/WelcomeBanner';
import WelcomeTourModal from './components/common/WelcomeTourModal';
import useClearHoverOnScroll from './hooks/useClearHoverOnScroll';

export default function App() {
  useClearHoverOnScroll();

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
              <ForcePasswordChangeModal />
              <WelcomeTourModal />
              <WelcomeBanner />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
