'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Handshake, User, Home, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import styles from './deals.module.css';

const STAGES = ['proposal', 'negotiation', 'documentation', 'closing', 'closed_won', 'closed_lost'];
const STAGE_COLORS = {
  proposal: '#74B9FF', negotiation: '#A29BFE', documentation: '#FDCB6E',
  closing: '#00D2FF', closed_won: '#00B894', closed_lost: '#FF6B6B'
};

const emptyForm = {
  title: '', lead_id: '', property_id: '', deal_value: '', stage: 'proposal',
  commission_percent: '2', expected_close_date: '', notes: ''
};

export default function DealsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) { loadDeals(); loadLeads(); loadProperties(); }
  }, [user]);

  const loadDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*, leads(full_name), properties(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDeals(data || []);
    } catch (err) {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    const { data } = await supabase.from('leads').select('id, full_name').eq('user_id', user.id);
    setLeads(data || []);
  };

  const loadProperties = async () => {
    const { data } = await supabase.from('properties').select('id, title').eq('user_id', user.id);
    setProperties(data || []);
  };

  const openAdd = () => { setEditingDeal(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (deal) => {
    setEditingDeal(deal);
    setForm({
      title: deal.title || '', lead_id: deal.lead_id || '', property_id: deal.property_id || '',
      deal_value: deal.deal_value || '', stage: deal.stage || 'proposal',
      commission_percent: deal.commission_percent || '2',
      expected_close_date: deal.expected_close_date || '', notes: deal.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.deal_value) {
      toast.warning('Title and Deal Value are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        deal_value: Number(form.deal_value) || 0,
        commission_percent: Number(form.commission_percent) || 2,
        lead_id: form.lead_id || null,
        property_id: form.property_id || null,
        expected_close_date: form.expected_close_date || null,
        actual_close_date: form.stage === 'closed_won' ? new Date().toISOString().split('T')[0] : null,
      };
      if (editingDeal) {
        const { error } = await supabase.from('deals').update(payload).eq('id', editingDeal.id);
        if (error) throw error;
        toast.success('Deal updated');
      } else {
        const { error } = await supabase.from('deals').insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success('Deal created');
      }
      setModalOpen(false);
      loadDeals();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (id) => {
    if (!confirm('Delete this deal?')) return;
    try {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deal deleted');
      loadDeals();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    const num = Number(val);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const totalPipeline = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + Number(d.deal_value || 0), 0);
  const wonValue = deals.filter(d => d.stage === 'closed_won').reduce((s, d) => s + Number(d.deal_value || 0), 0);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Deals</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Manage your deals & track revenue — {deals.length} total
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Deal</button>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Active Pipeline</span>
          <span className={styles.summaryValue} style={{ color: 'var(--accent)' }}>{formatCurrency(totalPipeline)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Won Revenue</span>
          <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>{formatCurrency(wonValue)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Active Deals</span>
          <span className={styles.summaryValue}>{deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length}</span>
        </div>
      </div>

      {loading ? (
        <div className={styles.dealsGrid}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 200 }} />)}</div>
      ) : deals.length === 0 ? (
        <div className="card"><div className="empty-state"><span style={{ fontSize: '3rem' }}><Handshake size={48} /></span><h3>No deals yet</h3><p>Create your first deal to start tracking revenue</p></div></div>
      ) : (
        <div className={styles.dealsGrid}>
          {deals.map((deal, i) => (
            <div
              key={deal.id}
              className={styles.dealCard}
              style={{ animationDelay: `${i * 60}ms`, borderTopColor: STAGE_COLORS[deal.stage] }}
            >
              <div className={styles.dealHeader}>
                <h4 className={styles.dealTitle}>{deal.title}</h4>
                <span className={`badge badge-${deal.stage === 'closed_won' ? 'won' : deal.stage === 'closed_lost' ? 'lost' : 'negotiation'}`}>
                  {deal.stage?.replace(/_/g, ' ')}
                </span>
              </div>

              <div className={styles.dealValue}>{formatCurrency(deal.deal_value)}</div>

              {/* Stage Progress */}
              <div className={styles.stageProgress}>
                {STAGES.slice(0, 4).map((s, idx) => {
                  const currentIdx = STAGES.indexOf(deal.stage);
                  const active = idx <= currentIdx && currentIdx < 4;
                  return (
                    <div key={s} className={`${styles.stageStep} ${active ? styles.stageActive : ''}`}>
                      <div className={styles.stageDot} style={active ? { background: STAGE_COLORS[deal.stage] } : {}} />
                      {idx < 3 && <div className={`${styles.stageLine} ${active && idx < currentIdx ? styles.lineActive : ''}`} />}
                    </div>
                  );
                })}
              </div>
              <div className={styles.stageLabels}>
                {STAGES.slice(0, 4).map(s => (
                  <span key={s} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {s}
                  </span>
                ))}
              </div>

              <div className={styles.dealMeta}>
                {deal.leads?.full_name && <span><User size={12} style={{display:'inline',verticalAlign:'middle'}} /> {deal.leads.full_name}</span>}
                {deal.properties?.title && <span><Home size={12} style={{display:'inline',verticalAlign:'middle'}} /> {deal.properties.title}</span>}
                {deal.expected_close_date && <span><CalendarDays size={12} style={{display:'inline',verticalAlign:'middle'}} /> {new Date(deal.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
              </div>

              <div className={styles.dealFooter}>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                  Commission: {formatCurrency(Number(deal.deal_value || 0) * Number(deal.commission_percent || 2) / 100)}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(deal)}><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteDeal(deal.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDeal ? 'Edit Deal' : 'New Deal'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingDeal ? 'Update' : 'Create Deal'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Deal Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., 3BHK Sale - Sector 150" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Deal Value (₹) *</label>
            <input className="form-input" type="number" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })} placeholder="e.g., 7500000" />
          </div>
          <div className="form-group">
            <label className="form-label">Commission %</label>
            <input className="form-input" type="number" step="0.1" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Stage</label>
            <select className="form-select" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
              {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expected Close Date</label>
            <input className="form-input" type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Lead</label>
            <select className="form-select" value={form.lead_id} onChange={e => setForm({ ...form, lead_id: e.target.value })}>
              <option value="">Select lead (optional)</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Property</label>
            <select className="form-select" value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })}>
              <option value="">Select property (optional)</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Deal notes..." />
        </div>
      </Modal>
    </div>
  );
}
