'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (userId) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (mounted && data) setUserProfile(data);
      } catch {
        // non-critical — app works without profile
      }
    };

    // Hard safety: if INITIAL_SESSION never fires (Supabase unreachable,
    // storage corruption, etc.), force loading=false after 6s so the app
    // doesn't hang on a spinner forever.
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 6000);

    // Manual initial check to ensure session is captured if onAuthStateChange is slow
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session) {
          const currentUser = session.user;
          setUser(currentUser);
          await fetchProfile(currentUser.id);
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      } catch (err) {
        console.error('Initial session check failed', err);
      }
    };

    checkInitialSession();

    // onAuthStateChange fires INITIAL_SESSION immediately on mount,
    // which gives us the current session without a separate getSession call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
          // Always clear loading after the session is resolved
          clearTimeout(safetyTimer);
          if (mounted) setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUserProfile(null);
          clearTimeout(safetyTimer);
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const sendOtp = async (email) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    return data;
  };

  const verifyOtp = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return data;
  };

  // Register a new organization + admin user via server API
  const registerOrg = async (orgName, fullName, email, password) => {
    const res = await fetch('/api/org/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, fullName, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  };

  const signInWithPassword = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, sendOtp, verifyOtp, registerOrg, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
