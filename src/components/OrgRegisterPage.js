'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Building2, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import styles from './OrgRegisterPage.module.css';

export default function OrgRegisterPage({ onLoginClick, onBackClick }) {
  const { registerOrg, signInWithPassword } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgName || !fullName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // 1. Create organization + admin user via server API
      await registerOrg(orgName, fullName, email, password);
      
      // 2. Auto sign-in with the credentials just created
      setSuccess('Organization created! Signing you in...');
      await signInWithPassword(email, password);
      // AuthContext will detect the session and redirect to dashboard
    } catch (err) {
      setError(err.message || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.bgDecor}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.orb3}></div>
      </div>

      <div className={styles.card}>
        <button className="btn btn-secondary btn-sm" onClick={onBackClick} style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
          <ArrowLeft size={14} /> Back
        </button>

        <div className={styles.header} style={{ marginTop: 24 }}>
          <div className={styles.logoIcon}>
            <img src="/logo.png" alt="DealBook Logo" className={styles.logoImage} />
          </div>
          <h1 className={styles.title}>Register Organization</h1>
          <p className={styles.subtitle}>Get started with your DealBook Trial</p>
        </div>

        {success ? (
          <div className={styles.form}>
            <div className={styles.successMsg}>{success}</div>
            <button className="btn btn-primary btn-lg" onClick={onLoginClick} style={{ marginTop: 12 }}>
              Go to Login Page
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={14} /> Organization Name *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Acme Realty"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} /> Admin Full Name *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={14} /> Admin Email Address *
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} /> Password *
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
              {loading ? (
                <span className={styles.spinner}></span>
              ) : (
                <>Start Free Trial →</>
              )}
            </button>

            <div className={styles.bottomRow}>
              <span>Already registered?</span>
              <button type="button" className={styles.toggleBtn} onClick={onLoginClick}>
                Log In
              </button>
            </div>
          </form>
        )}
      </div>

      <p className={styles.copyright}>© 2026 DealBook — Real Estate Management</p>
    </div>
  );
}
