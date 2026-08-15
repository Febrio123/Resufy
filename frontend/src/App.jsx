import { MotionConfig } from 'framer-motion';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './components/routing/AppRoutes';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { PaymentDialogProvider } from './contexts/PaymentDialogContext';

/**
 * App — provider chain: Toast (paling luar agar dipakai semua context),
 * Auth (session), PaymentDialog (modal pembayaran global).
 * MotionConfig reducedMotion="user" → semua animasi framer-motion (Button,
 * Tabs pill, bottom-nav pill, Modal, Toast) hormati prefers-reduced-motion
 * otomatis, termasuk yang tidak punya guard manual (dev pass §12).
 */
export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider>
            <PaymentDialogProvider>
              <AppRoutes />
            </PaymentDialogProvider>
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
