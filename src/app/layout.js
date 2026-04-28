import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';

export const metadata = {
  title: 'RealCRM — Real Estate CRM',
  description: 'Modern Real Estate CRM for managing leads, follow-ups, deals, and properties. Track your pipeline from lead to close.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
