'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Phone, Handshake, Home, Mail, MessageSquare, Video, ClipboardList, Bell, CalendarDays, User, Check, Pencil, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import styles from './followups.module.css';

const TYPES = ['call', 'meeting', 'site_visit', 'email', 'whatsapp', 'video_call', 'other'];
const FU_STATUSES = ['pending', 'completed', 'missed', 'rescheduled', 'cancelled'];

const emptyForm = {
  lead_id: '', title: '', description: '', follow_up_date: '', follow_up_type: 'call', status: 'pending', outcome: ''
};

export default function FollowupsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFu, setEditingFu] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState('upcoming');
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadFollowups();
      loadLeads();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadFollowups = async () => {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*, leads(full_name, phone)')
        .eq('user_id', user.id)
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      setFollowups(data || []);
    } catch (err) {
      toast.error('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    const { data } = await supabase.from('leads').select('id, full_name').eq('user_id', user.id).order('full_name');
    setLeads(data || []);
  };

  const openAdd = () => {
    setEditingFu(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const scheduleSiteVisit = () => {
    setEditingFu(null);
    setForm({ ...emptyForm, follow_up_type: 'site_visit' });
    setModalOpen(true);
  };

  const openEdit = (fu) => {
    setEditingFu(fu);
    setForm({
      lead_id: fu.lead_id || '',
      title: fu.title || '',
      description: fu.description || '',
      follow_up_date: fu.follow_up_date ? new Date(fu.follow_up_date).toISOString().slice(0, 16) : '',
      follow_up_type: fu.follow_up_type || 'call',
      status: fu.status || 'pending',
      outcome: fu.outcome || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.lead_id || !form.title || !form.follow_up_date) {
      toast.warning('Lead, Title, and Date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, follow_up_date: new Date(form.follow_up_date).toISOString() };
      if (editingFu) {
        const { error } = await supabase.from('follow_ups').update(payload).eq('id', editingFu.id);
        if (error) throw error;
        toast.success('Follow-up updated');
      } else {
        const { error } = await supabase.from('follow_ups').insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success('Follow-up scheduled');
      }
      setModalOpen(false);
      loadFollowups();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (fu) => {
    // Optimistic: update status in UI immediately
    setFollowups(prev => prev.map(f => f.id === fu.id ? { ...f, status: 'completed' } : f));
    try {
      const { error } = await supabase.from('follow_ups').update({ status: 'completed' }).eq('id', fu.id);
      if (error) throw error;
      toast.success('Marked as completed');
    } catch (err) {
      toast.error('Failed to update');
      loadFollowups(); // revert on failure
    }
  };

  const deleteFu = async (id) => {
    if (!confirm('Delete this follow-up?')) return;
    try {
      const { error } = await supabase.from('follow_ups').delete().eq('id', id);
      if (error) throw error;
      toast.success('Follow-up deleted');
      loadFollowups();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const now = new Date();
  const filtered = followups.filter(fu => {
    const fuDate = new Date(fu.follow_up_date);
    if (tab === 'upcoming') return fu.status === 'pending' && fuDate >= now;
    if (tab === 'overdue') return fu.status === 'pending' && fuDate < now;
    if (tab === 'completed') return fu.status === 'completed';
    return true;
  });

  const typeIcons = { call: <Phone size={16} />, meeting: <Handshake size={16} />, site_visit: <Home size={16} />, email: <Mail size={16} />, whatsapp: <MessageSquare size={16} />, video_call: <Video size={16} />, other: <ClipboardList size={16} /> };

  const formatDateTime = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' • ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getRelativeTime = (d) => {
    const diff = new Date(d) - now;
    const hours = Math.floor(Math.abs(diff) / 3600000);
    const days = Math.floor(hours / 24);
    if (diff < 0) {
      if (days > 0) return `${days}d overdue`;
      return `${hours}h overdue`;
    }
    if (days > 0) return `in ${days}d`;
    return `in ${hours}h`;
  };

  const overdueCnt = followups.filter(f => f.status === 'pending' && new Date(f.follow_up_date) < now).length;
  const todaysVisits = followups.filter(f => 
    f.status === 'pending' && 
    f.follow_up_type === 'site_visit' && 
    new Date(f.follow_up_date).toDateString() === now.toDateString()
  );

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    weekdays.forEach(day => days.push(<div key={day} className={styles.calendarDayHeader}>{day}</div>));
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className={styles.calendarDayEmpty}></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isToday = now.toDateString() === date.toDateString();
      const dayEvents = followups.filter(fu => new Date(fu.follow_up_date).toDateString() === date.toDateString());
      
      days.push(
        <div 
          key={i} 
          className={`${styles.calendarDay} ${isToday ? styles.today : ''}`}
          onClick={() => {
            const dateStr = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setForm({ ...emptyForm, follow_up_date: dateStr, follow_up_type: 'site_visit' });
            setEditingFu(null);
            setModalOpen(true);
          }}
        >
          <div className={styles.dayNumber}>{i}</div>
          <div className={styles.dayEvents}>
            {dayEvents.map(ev => (
              <div 
                key={ev.id} 
                className={`${styles.eventBadge} ${ev.follow_up_type === 'site_visit' ? styles.siteVisit : ''}`}
                onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                title={`${ev.title} - ${ev.status}`}
                style={{ textDecoration: ev.status === 'completed' ? 'line-through' : 'none', opacity: ev.status === 'completed' ? 0.6 : 1 }}
              >
                {typeIcons[ev.follow_up_type]} {ev.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Follow-ups & Visits</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Track your schedule — {followups.length} total events
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={scheduleSiteVisit}>+ Schedule Site Visit</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Schedule Follow-up</button>
        </div>
      </div>

      {todaysVisits.length > 0 && (
        <div className={styles.reminderBanner}>
          <span><Bell size={18} /></span>
          <div>
            <strong>Reminder:</strong> You have {todaysVisits.length} site visit{todaysVisits.length > 1 ? 's' : ''} scheduled for today.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'overdue', label: `Overdue${overdueCnt > 0 ? ` (${overdueCnt})` : ''}` },
          { key: 'completed', label: 'Completed' },
          { key: 'calendar', label: 'Calendar' },
          { key: 'all', label: 'All' },
        ].map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.activeTab : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : tab === 'calendar' ? (
        <div>
          <div className={styles.calendarHeader}>
            <h3>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={prevMonth}>&lt; Prev</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Today</button>
              <button className="btn btn-ghost btn-sm" onClick={nextMonth}>Next &gt;</button>
            </div>
          </div>
          <div className={styles.calendarGrid}>
            {renderCalendar()}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}><CalendarDays size={48} /></span>
            <h3>No events found</h3>
            <p>{tab === 'overdue' ? 'Great! No overdue events' : 'Schedule an event to get started'}</p>
          </div>
        </div>
      ) : (
        <div className={styles.fuList}>
          {filtered.map((fu, i) => {
            const isOverdue = fu.status === 'pending' && new Date(fu.follow_up_date) < now;
            return (
              <div
                key={fu.id}
                className={`${styles.fuCard} ${isOverdue ? styles.overdue : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={styles.fuCardRow}>
                  <div className={styles.fuIcon}>
                    {typeIcons[fu.follow_up_type] || <ClipboardList size={16} />}
                  </div>
                  <div className={styles.fuBody}>
                    <div className={styles.fuTop}>
                      <span className={styles.fuTitle}>{fu.title}</span>
                      <span className={`badge badge-${fu.status}`}>{fu.status}</span>
                    </div>
                    <div className={styles.fuMeta}>
                      <span><User size={12} style={{display:'inline',verticalAlign:'middle'}} /> {fu.leads?.full_name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{fu.follow_up_type?.replace(/_/g, ' ')}</span>
                      <span>•</span>
                      <span>{formatDateTime(fu.follow_up_date)}</span>
                      {fu.status === 'pending' && (
                        <>
                          <span>•</span>
                          <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--accent)', fontWeight: 600 }}>
                            {getRelativeTime(fu.follow_up_date)}
                          </span>
                        </>
                      )}
                    </div>
                    {fu.description && <p className={styles.fuDesc}>{fu.description}</p>}
                  </div>
                </div>
                <div className={styles.fuActions}>
                  {fu.status === 'pending' && (
                    <button className="btn btn-success btn-sm" onClick={() => markComplete(fu)} title="Mark Complete"><Check size={14} /></button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(fu)} title="Edit"><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteFu(fu.id)} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFu ? 'Edit Follow-up' : 'Schedule Follow-up'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingFu ? 'Update' : 'Schedule'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Lead *</label>
          <select className="form-select" value={form.lead_id} onChange={e => setForm({ ...form, lead_id: e.target.value })}>
            <option value="">Select a lead</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Follow-up call for 3BHK inquiry" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Date & Time *</label>
            <input className="form-input" type="datetime-local" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.follow_up_type} onChange={e => setForm({ ...form, follow_up_type: e.target.value })}>
              {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
        {editingFu && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {FU_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Notes about this follow-up..." />
        </div>
        {editingFu && (
          <div className="form-group">
            <label className="form-label">Outcome</label>
            <textarea className="form-textarea" value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })} placeholder="What was the result?" />
          </div>
        )}
      </Modal>
    </div>
  );
}
