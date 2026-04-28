'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        if (mounted) setUser(currentUser);
        
        if (currentUser) {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
          if (mounted && data) setUserProfile(data);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Only re-fetch profile on explicit SIGN_IN, avoid blocking UI on tab focus (TOKEN_REFRESHED, etc)
      if (event === 'SIGNED_IN' && currentUser) {
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
          if (mounted && data) setUserProfile(data);
        } catch (err) {
          console.error('Failed to fetch profile on sign in', err);
        }
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null);
        // Do not force setLoading(false) here, we don't want to mess with navigation state
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Send OTP to email
  const sendOtp = async (email) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // auto sign-up if new user
      },
    });
    if (error) throw error;
    return data;
  };

  // Verify OTP code
  const verifyOtp = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return data;
  };

  // Sign in with password
  const signInWithPassword = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, sendOtp, verifyOtp, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
