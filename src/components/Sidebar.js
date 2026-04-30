'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';
import { LayoutDashboard, Users, RefreshCw, CalendarCheck, Building2, Handshake, Home, FileText, UserCheck, BarChart3, Briefcase, ChevronRight, ChevronLeft, BookOpen, CheckSquare, Megaphone } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { href: '/leads', icon: <Users size={20} />, label: 'Leads' },
  { href: '/pipeline', icon: <RefreshCw size={20} />, label: 'Pipeline' },
  { href: '/followups', icon: <CalendarCheck size={20} />, label: 'Follow-ups' },
  { href: '/tasks', icon: <CheckSquare size={20} />, label: 'Tasks' },
  { href: '/inventory', icon: <Building2 size={20} />, label: 'Inventory' },
  { href: '/bookings', icon: <BookOpen size={20} />, label: 'Bookings' },
  { href: '/deals', icon: <Handshake size={20} />, label: 'Deals' },
  { href: '/properties', icon: <Home size={20} />, label: 'Properties' },
  { href: '/documents', icon: <FileText size={20} />, label: 'Documents' },
  { href: '/partners', icon: <UserCheck size={20} />, label: 'Partners' },
];

import { useAuth } from '@/context/AuthContext';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();

  const isAdmin = userProfile?.role === 'admin';

  const currentNavItems = [
    ...navItems,
    ...(isAdmin ? [
      { href: '/campaigns', icon: <Megaphone size={20} />, label: 'Campaigns' },
      { href: '/analytics', icon: <BarChart3 size={20} />, label: 'Analytics' },
      { href: '/team', icon: <Briefcase size={20} />, label: 'Team' }
    ] : [])
  ];

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <img src="/logo.png" alt="DealBook Logo" className={styles.logoImage} />
        </div>
        {!collapsed && (
          <div className={styles.logoText}>
            <h2>DealBook</h2>
            <span>Real Estate Manager</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        <span className={styles.navLabel}>{!collapsed && 'MAIN MENU'}</span>
        {currentNavItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
            title={item.label}
            onClick={onMobileClose}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span className={styles.navText}>{item.label}</span>}
            {pathname === item.href && <div className={styles.activeIndicator} />}
          </Link>
        ))}
      </nav>

      <button className={styles.collapseBtn} onClick={onToggle}>
        <span>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</span>
      </button>
    </aside>
  );
}
