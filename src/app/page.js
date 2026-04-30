'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoginPage from '@/components/LoginPage';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Safety: if auth loading takes more than 4s, show login anyway
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if ((!loading || timedOut) && user) {
      router.push('/dashboard');
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
          border: '3px solid rgba(108,92,231,0.2)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  if (user) return null;

  return <LoginPage />;
}
