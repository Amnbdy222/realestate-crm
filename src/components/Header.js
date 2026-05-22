'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './Header.module.css';
import { Search, LogOut, Menu, ChevronDown, Copy, Check } from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Header({ collapsed, onMobileMenuToggle }) {
  const { user, userProfile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopyOrgId = async (orgId) => {
    if (!orgId) return;
    try {
      await navigator.clipboard.writeText(orgId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <header className={styles.header} style={{ left: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}>
      <div className={styles.left}>
        {/* Hamburger — mobile only */}
        <button className={styles.hamburger} onClick={onMobileMenuToggle} aria-label="Open menu">
          <Menu size={22} />
        </button>

        <div className={styles.searchBox}>
          <span className={styles.searchIcon}><Search size={16} /></span>
          <input
            type="text"
            placeholder="Search leads, deals, properties..."
            className={styles.searchInput}
          />
          <kbd className={styles.kbd}>⌘K</kbd>
        </div>
      </div>

      <div className={styles.right}>
        <NotificationBell />

        <div className={styles.userMenuContainer} ref={dropdownRef}>
          <div 
            className={styles.userMenu} 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div className={styles.avatar}>
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userProfile?.full_name || user?.email?.split('@')[0] || 'User'}</span>
              <span className={styles.userRole} style={{ textTransform: 'capitalize' }}>{userProfile?.role || 'Agent'}</span>
            </div>
            <ChevronDown size={14} className={styles.chevron} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </div>

          {dropdownOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div className={styles.largeAvatar}>
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className={styles.dropdownHeaderInfo}>
                  <span className={styles.dropdownName}>{userProfile?.full_name || 'User'}</span>
                  <span className={styles.dropdownEmail}>{user?.email}</span>
                </div>
              </div>
              
              <div className={styles.dropdownBody}>
                <div className={styles.dropdownItem}>
                  <span className={styles.dropdownLabel}>Organization</span>
                  <span className={styles.dropdownValue}>{userProfile?.org_name || 'No Organization'}</span>
                </div>
                <div className={styles.dropdownItem}>
                  <span className={styles.dropdownLabel}>Role</span>
                  <span className={styles.dropdownValue} style={{ textTransform: 'capitalize' }}>{userProfile?.role || 'Agent'}</span>
                </div>
                {userProfile?.org_id && (
                  <div className={styles.dropdownItem}>
                    <span className={styles.dropdownLabel}>Organization ID</span>
                    <div className={styles.dropdownIdWrapper}>
                      <span className={styles.dropdownValueCode}>{userProfile.org_id}</span>
                      <button 
                        className={styles.copyBtn} 
                        onClick={() => handleCopyOrgId(userProfile.org_id)} 
                        title="Copy Org ID"
                      >
                        {copied ? <Check size={12} className={styles.checkIcon} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.dropdownDivider} />

              <button className={styles.dropdownSignout} onClick={signOut}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
