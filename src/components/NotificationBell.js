'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Bell, Check, CheckCheck, Calendar, Users, Handshake, X, BellRing } from 'lucide-react';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchNotifications = async () => {
      await loadNotifications(isMounted, controller.signal);
    };

    fetchNotifications();

    // Poll every 60s to refresh the dynamic time-based follow-up statuses
    const interval = setInterval(fetchNotifications, 60_000);

    // Subscribe to realtime updates for persistent notifications
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          if (isMounted) fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(interval);
      controller.abort();
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async (isMounted, signal) => {
    if (!user) return;
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // next 24h

    try {
      // Execute queries sequentially to prevent Supabase GoTrue auth-lock contention
      const { data: overdue } = await supabase.from('follow_ups').select('id, title, follow_up_date, leads(full_name)').eq('user_id', user.id).eq('status', 'pending').lt('follow_up_date', now.toISOString()).order('follow_up_date', { ascending: false }).limit(5).abortSignal(signal);
      if (!isMounted) return;

      const { data: upcoming } = await supabase.from('follow_ups').select('id, title, follow_up_date, leads(full_name)').eq('user_id', user.id).eq('status', 'pending').gte('follow_up_date', now.toISOString()).lte('follow_up_date', soon.toISOString()).order('follow_up_date', { ascending: true }).limit(5).abortSignal(signal);
      if (!isMounted) return;

      const { data: persistent } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).abortSignal(signal);
      if (!isMounted) return;

      const items = [
        ...(persistent || []).map(n => ({
          id: n.id,
          isPersistent: true, // indicates it's from the notifications table
          type: n.type || 'system',
          icon: n.type,
          title: n.title,
          subtitle: n.body,
          time: n.created_at,
          read: n.read,
          href: n.link || '#',
        })),
        ...(overdue || []).map(f => ({
          id: `overdue-${f.id}`,
          isPersistent: false,
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
          isPersistent: false,
          type: 'upcoming',
          icon: 'calendar',
          title: `Due soon: ${f.title}`,
          subtitle: `${f.leads?.full_name} • ${formatRelative(f.follow_up_date)}`,
          time: f.follow_up_date,
          read: false,
          href: '/followups',
        })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time));

      setNotifications(items);
      setUnreadCount(items.filter(i => !i.read).length);
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Error loading notifications:', err);
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    
    // Update persistent ones in the database
    const persistentIds = notifications.filter(n => n.isPersistent && !n.read).map(n => n.id);
    if (persistentIds.length > 0) {
      await supabase.from('notifications').update({ read: true }).in('id', persistentIds);
    }
  };

  const dismiss = async (id, isPersistent) => {
    // Optimistic UI update
    setNotifications(prev => {
      const isUnread = !prev.find(n => n.id === id)?.read;
      if (isUnread) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== id);
    });

    if (isPersistent) {
      await supabase.from('notifications').delete().eq('id', id);
    }
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
    lead: <Users size={14} />,
    system: <BellRing size={14} />
  };

  const colorMap = {
    overdue: 'var(--danger)',
    upcoming: 'var(--warning)',
    lead: 'var(--primary)',
    deal: 'var(--success)',
    system: 'var(--text-secondary)'
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
                    onClick={e => { e.preventDefault(); e.stopPropagation(); dismiss(n.id, n.isPersistent); }}
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
