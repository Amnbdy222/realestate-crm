'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Building2, Mail } from 'lucide-react';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { sendOtp, verifyOtp, signInWithPassword } = useAuth();
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' or 'password'
  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      if (loginMethod === 'password') {
        if (!password) {
          throw new Error('Please enter your password');
        }
        await signInWithPassword(email, password);
        // Successful login will trigger AuthContext state update
      } else {
        await sendOtp(email);
        setSuccess('OTP sent! Check your email inbox.');
        setStep('otp');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      // Focus the last filled input or the next empty one
      const focusIdx = Math.min(pasted.length, 5);
      const el = document.getElementById(`otp-${focusIdx}`);
      if (el) el.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(email, code);
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      await sendOtp(email);
      setSuccess('New OTP sent!');
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('email');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setSuccess('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.bgDecor}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.orb3}></div>
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoIcon}><Building2 size={32} color="white" /></div>
          <h1 className={styles.title}>RealCRM</h1>
          <p className={styles.subtitle}>
            {step === 'email' ? 'Sign in to your account' : 'Enter the verification code'}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className={styles.form}>
            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {loginMethod === 'password' && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
              {loading ? (
                <span className={styles.spinner}></span>
              ) : (
                <>{loginMethod === 'password' ? 'Sign In' : 'Send OTP →'}</>
              )}
            </button>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button 
                type="button" 
                className={styles.toggleBtn}
                onClick={() => setLoginMethod(loginMethod === 'otp' ? 'password' : 'otp')}
              >
                {loginMethod === 'otp' ? 'Sign in with Password instead' : 'Sign in with Email OTP instead'}
              </button>
            </div>

            {loginMethod === 'otp' && (
              <p className={styles.hint}>
                We'll send a 6-digit verification code to your email. New users are auto-registered.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className={styles.form}>
            {error && <div className={styles.errorMsg}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <div className={styles.emailBadge}>
              <span><Mail size={16} /></span>
              <span>{email}</span>
              <button type="button" className={styles.changeBtn} onClick={goBack}>Change</button>
            </div>

            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <div className={styles.otpContainer} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`${styles.otpInput} ${digit ? styles.otpFilled : ''}`}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
              {loading ? (
                <span className={styles.spinner}></span>
              ) : (
                <>Verify & Sign In</>
              )}
            </button>

            <div className={styles.resendRow}>
              <span>Didn&apos;t receive the code?</span>
              <button type="button" className={styles.toggleBtn} onClick={handleResend} disabled={loading}>
                Resend OTP
              </button>
            </div>
          </form>
        )}
      </div>

      <p className={styles.copyright}>© 2026 RealCRM — Real Estate Management</p>
    </div>
  );
}
