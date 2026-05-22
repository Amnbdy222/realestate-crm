'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Handshake } from 'lucide-react';
import Modal from '@/components/Modal';
import styles from './partners.module.css';

export default function PartnersPage() {
  const { user, userProfile } = useAuth();
  const toast = useToast();
  const orgId = userProfile?.org_id;
  
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState('partners'); // 'partners' | 'webhooks'
  const [webhookLogs, setWebhookLogs] = useState([]);
  
  const emptyForm = { agency_name: '', broker_name: '', phone: '', rera_number: '', commission_percent: 2.0 };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadPartners();
  }, [user]);

  useEffect(() => {
    if (tab === 'webhooks') loadWebhookLogs();
  }, [tab]);

  const loadWebhookLogs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/external/webhook-logs', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setWebhookLogs(data.logs || []);
    } catch {
      toast.error('Failed to load webhook logs');
    }
  };

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase.from('channel_partners').select('*').order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      setPartners(data || []);
    } catch (err) {
      toast.error('Failed to load partners. Did you run the SQL migration?');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.agency_name || !form.broker_name || !form.phone) {
      toast.warning('Agency, Broker Name, and Phone are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('channel_partners').insert([{
        ...form,
        user_id: user.id,
        org_id: orgId
      }]);
      if (error) throw error;
      toast.success('Channel Partner added');
      setModalOpen(false);
      setForm(emptyForm);
      loadPartners();
    } catch (err) {
      toast.error('Failed to add partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Channel Partners</h1>
          <p className="text-muted">Manage your broker network and commissions</p>
        </div>
        {tab === 'partners' && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Partner</button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {[
          { key: 'partners', label: 'Channel Partners' },
          { key: 'webhooks', label: 'Webhook Logs' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'partners' ? (
        loading ? (
          <div>Loading...</div>
        ) : partners.length === 0 ? (
          <div className="empty-state card">
            <Handshake size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3>No Channel Partners</h3>
            <p>Add your first broker to start tracking their sales and commissions.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {partners.map(cp => (
              <div key={cp.id} className={styles.partnerCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.agencyName}>{cp.agency_name}</div>
                    <div className={styles.brokerName}>{cp.broker_name}</div>
                  </div>
                  <div className={styles.commissionBadge}>{cp.commission_percent}%</div>
                </div>
                
                <div className={styles.details}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Phone</span>
                    <span className={styles.detailValue}>{cp.phone}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>RERA No.</span>
                    <span className={styles.detailValue}>{cp.rera_number || 'N/A'}</span>
                  </div>
                </div>
                
                <div className={styles.actions}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: 8 }}>View Bookings</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Webhook Logs Tab */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Last {webhookLogs.length} webhook deliveries to <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>/api/external/leads</code>
            </p>
            <button className="btn btn-secondary btn-sm" onClick={loadWebhookLogs}>↻ Refresh</button>
          </div>

          {webhookLogs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '2rem', marginBottom: 12 }}>📡</span>
                <h3>No webhook deliveries yet</h3>
                <p>Logs appear here when external systems POST to the leads webhook</p>
              </div>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Lead Name</th>
                    <th>Phone</th>
                    <th>Owner Email</th>
                    <th>Source</th>
                    <th>Timestamp</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookLogs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: log.status === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: log.status === 'success' ? 'var(--success)' : 'var(--danger)',
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td>{log.payload?.full_name || '—'}</td>
                      <td>{log.payload?.phone || '—'}</td>
                      <td>{log.payload?.owner_email || '—'}</td>
                      <td>{log.payload?.source || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--danger)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Channel Partner"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Add Partner'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Agency Name *</label>
            <input className="form-input" value={form.agency_name} onChange={e => setForm({...form, agency_name: e.target.value})} placeholder="e.g. Dream Homes Realty" />
          </div>
          <div className="form-group">
            <label className="form-label">Broker / Contact Name *</label>
            <input className="form-input" value={form.broker_name} onChange={e => setForm({...form, broker_name: e.target.value})} placeholder="e.g. Ramesh Singh" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 99999 99999" />
          </div>
          <div className="form-group">
            <label className="form-label">RERA Registration No.</label>
            <input className="form-input" value={form.rera_number} onChange={e => setForm({...form, rera_number: e.target.value})} placeholder="e.g. UPRERAAGT1234" />
          </div>
          <div className="form-group">
            <label className="form-label">Standard Commission (%)</label>
            <input className="form-input" type="number" step="0.1" value={form.commission_percent} onChange={e => setForm({...form, commission_percent: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
