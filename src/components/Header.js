'use client';
import { useAuth } from '@/context/AuthContext';
import styles from './Header.module.css';
import { Search, LogOut, Menu } from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Header({ collapsed, onMobileMenuToggle }) {
  const { user, userProfile, signOut } = useAuth();

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

        <div className={styles.userMenu}>
          <div className={styles.avatar}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{userProfile?.full_name || user?.email?.split('@')[0] || 'User'}</span>
            <span className={styles.userRole} style={{ textTransform: 'capitalize' }}>{userProfile?.role || 'Agent'}</span>
          </div>
          <button className={styles.logoutBtn} onClick={signOut} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
