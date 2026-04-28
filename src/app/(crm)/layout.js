'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';
import AIChatWidget from '@/components/AIChatWidget';

export default function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
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
          border: '3px solid rgba(108,92,231,0.2)',
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
