'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Bell, Check, CheckCheck, Calendar, Users, Handshake, X } from 'lucide-react';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Poll every 60s for new reminders
      const interval = setInterval(loadNotifications, 60_000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // next 24h

    // Overdue follow-ups
    const { data: overdue } = await supabase
      .from('follow_ups')
      .select('id, title, follow_up_date, leads(full_name)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('follow_up_date', now.toISOString())
      .order('follow_up_date', { ascending: false })
      .limit(5);

    // Upcoming follow-ups in next 24h
    const { data: upcoming } = await supabase
      .from('follow_ups')
      .select('id, title, follow_up_date, leads(full_name)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .gte('follow_up_date', now.toISOString())
      .lte('follow_up_date', soon.toISOString())
      .order('follow_up_date', { ascending: true })
      .limit(5);

    // New leads in last 24h
    const { data: newLeads } = await supabase
      .from('leads')
      .select('id, full_name, source, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(3);

    const items = [
      ...(overdue || []).map(f => ({
        id: `overdue-${f.id}`,
        type: 'overdue',
        icon: 'calendar',
        title: `Overdue: ${f.title}`,
        subtitle: `${f.leads?.full_name} • ${formatRelative(f.follow_up_date)}`,
        time: f.follow_up_date,
        read: false,
        href: '/followups',
      })),
      ...(upcoming || []).map(f => ({
        id: `upcoming-${f.id}`,
        type: 'upcoming',
        icon: 'calendar',
        title: `Due soon: ${f.title}`,
        subtitle: `${f.leads?.full_name} • ${formatRelative(f.follow_up_date)}`,
        time: f.follow_up_date,
        read: false,
        href: '/followups',
      })),
      ...(newLeads || []).map(l => ({
        id: `lead-${l.id}`,
        type: 'lead',
        icon: 'user',
        title: `New lead: ${l.full_name}`,
        subtitle: `via ${l.source?.replace(/_/g, ' ')} • ${formatRelative(l.created_at)}`,
        time: l.created_at,
        read: false,
        href: '/leads',
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time));

    setNotifications(items);
    setUnreadCount(items.length);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const dismiss = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const formatRelative = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    const hours = Math.floor(abs / 3600000);
    const days = Math.floor(abs / 86400000);
    const past = diff > 0;
    if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
    if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;
    return past ? `${days}d ago` : `in ${days}d`;
  };

  const iconMap = {
    calendar: <Calendar size={14} />,
    user: <Users size={14} />,
    deal: <Handshake size={14} />,
  };

  const colorMap = {
    overdue: 'var(--danger)',
    upcoming: 'var(--warning)',
    lead: 'var(--primary)',
  };

  return (
    <div className={styles.wrapper} ref={panelRef}>
      <button
        className={styles.bellBtn}
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            {notifications.length > 0 && (
              <button className={styles.markAllBtn} onClick={markAllRead}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                <Check size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p>All caught up!</p>
              </div>
            ) : (
              notifications.map(n => (
                <a
                  key={n.id}
                  href={n.href}
                  className={`${styles.item} ${!n.read ? styles.unread : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <div
                    className={styles.itemIcon}
                    style={{ background: `${colorMap[n.type]}18`, color: colorMap[n.type] }}
                  >
                    {iconMap[n.icon]}
                  </div>
                  <div className={styles.itemBody}>
                    <p className={styles.itemTitle}>{n.title}</p>
                    <p className={styles.itemSub}>{n.subtitle}</p>
                  </div>
                  <button
                    className={styles.dismissBtn}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
                  >
                    <X size={12} />
                  </button>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
