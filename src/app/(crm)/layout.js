'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import AIChatWidget from '@/components/AIChatWidget';

export default function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Safety: if loading takes more than 5s, force it to resolve
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if ((!loading || timedOut) && !user) {
      router.push('/');
    }
  }, [user, loading, timedOut, router]);

  if (loading && !timedOut) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: '3px solid rgba(79,70,229,0.2)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <AppShell>{children}</AppShell>
      <AIChatWidget />
    </>
  );
}
