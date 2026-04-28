'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 'calc(var(--z-sidebar) - 1)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Header
        collapsed={collapsed}
        onMobileMenuToggle={() => setMobileOpen(o => !o)}
      />

      <main
        style={{
          marginLeft: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          paddingTop: 'var(--header-height)',
          transition: 'margin-left 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh',
        }}
        className="app-main"
      >
        <div style={{ padding: '24px', maxWidth: '1400px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
