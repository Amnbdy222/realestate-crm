'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { BookOpen, IndianRupee, CheckCircle, XCircle, FileText, Pencil, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import styles from './bookings.module.css';

const STATUSES = ['token_received', 'agreement_done', 'registered', 'cancelled'];

const STATUS_COLORS = {
  token_received: 'var(--warning)',
  agreement_done: 'var(--accent)',
  registered: 'var(--success)',
  cancelled: 'var(--danger)',
};

const emptyForm = {
  unit_id: '',
  lead_id: '',
  cp_id: '',
  token_amount: '',
  booking_date: new Date().toISOString().slice(0, 10),
  status: 'token_received',
};

export default function BookingsPage() {
  const { user, userProfile } = useAuth();
  const toast = useToast();
  const orgId = userProfile?.org_id;

  const [bookings, setBookings] = useState([]);
  const [units, setUnits] = useState([]);
  const [leads, setLeads] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dataReady, setDataReady] = useState(false); // true once units+leads are loaded

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        bookingsRes,
        unitsRes,
        leadsRes,
        partnersRes,
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            *,
            units(unit_number, bhk_type, total_price, towers(name, projects(name))),
            leads(full_name, phone),
            channel_partners(broker_name, agency_name)
          `)
          .order('created_at', { ascending: false }),
        // Fetch ALL units (no status filter) so the dropdown is never empty
        supabase
          .from('units')
          .select('id, unit_number, bhk_type, total_price, status, towers(name, projects(name))'),
        // Fetch leads — RLS ensures only the current user's leads are returned
        supabase
          .from('leads')
          .select('id, full_name, phone')
          .order('full_name'),
        supabase
          .from('channel_partners')
          .select('id, broker_name, agency_name'),
      ]);

      // Log any errors without crashing the whole page
      if (bookingsRes.error) console.warn('Bookings error:', bookingsRes.error.message);
      if (unitsRes.error) console.warn('Units error:', unitsRes.error.message);
      if (leadsRes.error) console.warn('Leads error:', leadsRes.error.message);
      if (partnersRes.error) console.warn('Partners error:', partnersRes.error.message);

      setBookings(bookingsRes.data || []);
      setUnits(unitsRes.data || []);
      setLeads(leadsRes.data || []);
      setPartners(partnersRes.data || []);
      setDataReady(true);
    } catch (err) {
      toast.error('Failed to load bookings data');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingBooking(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (booking) => {
    setEditingBooking(booking);
    setForm({
      unit_id: booking.unit_id || '',
      lead_id: booking.lead_id || '',
      cp_id: booking.cp_id || '',
      token_amount: booking.token_amount || '',
      booking_date: booking.booking_date || new Date().toISOString().slice(0, 10),
      status: booking.status || 'token_received',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.unit_id || !form.lead_id || !form.token_amount || !form.booking_date) {
      toast.warning('Unit, Lead, Token Amount, and Date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        unit_id: form.unit_id,
        lead_id: form.lead_id,
        cp_id: form.cp_id || null,
        token_amount: Number(form.token_amount),
        booking_date: form.booking_date,
        status: form.status,
        user_id: user.id,
        org_id: orgId,
      };

      if (editingBooking) {
        const { error } = await supabase.from('bookings').update(payload).eq('id', editingBooking.id);
        if (error) throw error;
        toast.success('Booking updated');
      } else {
        const { error: bookingError } = await supabase.from('bookings').insert(payload);
        if (bookingError) throw bookingError;

        // Mark unit as booked
        await supabase.from('units').update({ status: 'booked' }).eq('id', form.unit_id);
        toast.success('Booking created');
      }

      setModalOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err.message || 'Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const deleteBooking = async (booking) => {
    if (!confirm('Delete this booking? The unit will be marked available again.')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', booking.id);
      if (error) throw error;
      // Restore unit to available
      await supabase.from('units').update({ status: 'available' }).eq('id', booking.unit_id);
      toast.success('Booking deleted');
      setBookings(prev => prev.filter(b => b.id !== booking.id));
    } catch {
      toast.error('Failed to delete booking');
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    const n = Number(val);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  const filtered = filterStatus === 'all'
    ? bookings
    : bookings.filter(b => b.status === filterStatus);

  const stats = {
    total: bookings.length,
    active: bookings.filter(b => b.status !== 'cancelled').length,
    registered: bookings.filter(b => b.status === 'registered').length,
    tokenValue: bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((s, b) => s + Number(b.token_amount || 0), 0),
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Manage unit bookings and token receipts
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Booking</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard icon={<BookOpen size={24} />} label="Total Bookings" value={stats.total} color="primary" delay={0} />
        <StatCard icon={<CheckCircle size={24} />} label="Active Bookings" value={stats.active} color="success" delay={100} />
        <StatCard icon={<FileText size={24} />} label="Registered" value={stats.registered} color="accent" delay={200} />
        <StatCard icon={<IndianRupee size={24} />} label="Token Value" value={formatCurrency(stats.tokenValue)} color="warning" delay={300} />
      </div>

      {/* Filter tabs */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {['all', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              borderBottom: filterStatus === s ? '2px solid var(--primary)' : '2px solid transparent',
              color: filterStatus === s ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3>No bookings found</h3>
            <p>Create a booking when a unit is reserved with a token amount</p>
          </div>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Lead / Buyer</th>
                <th>Channel Partner</th>
                <th>Token Amount</th>
                <th>Booking Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => {
                const unit = b.units;
                const project = unit?.towers?.projects?.name;
                const tower = unit?.towers?.name;
                return (
                  <tr key={b.id} className="animate-fadeInUp" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {unit ? `${unit.unit_number} — ${unit.bhk_type}` : '—'}
                      </div>
                      {(project || tower) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {project}{tower ? ` › ${tower}` : ''}
                        </div>
                      )}
                      {unit?.total_price && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                          {formatCurrency(unit.total_price)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.leads?.full_name || '—'}</div>
                      {b.leads?.phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.leads.phone}</div>
                      )}
                    </td>
                    <td>
                      {b.channel_partners ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{b.channel_partners.broker_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.channel_partners.agency_name}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Direct Sale</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--warning)' }}>
                      {formatCurrency(b.token_amount)}
                    </td>
                    <td>{new Date(b.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
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
                        background: `${STATUS_COLORS[b.status]}18`,
                        color: STATUS_COLORS[b.status],
                      }}>
                        {b.status === 'registered' && <CheckCircle size={10} />}
                        {b.status === 'cancelled' && <XCircle size={10} />}
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)} title="Edit"><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteBooking(b)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBooking ? 'Edit Booking' : 'New Booking'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingBooking ? 'Update' : 'Create Booking'}
            </button>
          </>
        }
      >
        {!dataReady ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 42, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Unit *</label>
            <select className="form-select" value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}>
              <option value="">
                {units.length === 0 ? '— No units found. Add units in Inventory first —' : 'Select a unit'}
              </option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.unit_number} — {u.bhk_type}
                  {u.towers?.projects?.name ? ` (${u.towers.projects.name} › ${u.towers.name})` : ''}
                  {' '}— {formatCurrency(u.total_price)}
                  {u.status !== 'available' ? ` [${u.status}]` : ''}
                </option>
              ))}
            </select>
            {units.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: 4 }}>
                ⚠️ No units found. Go to <a href="/inventory" style={{ color: 'var(--primary)' }}>Inventory</a> and add units first.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Lead / Buyer *</label>
            <select className="form-select" value={form.lead_id} onChange={e => setForm({ ...form, lead_id: e.target.value })}>
              <option value="">
                {leads.length === 0 ? '— No leads found. Add leads first —' : 'Select a lead'}
              </option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.full_name} — {l.phone}</option>
              ))}
            </select>
            {leads.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: 4 }}>
                ⚠️ No leads found. Go to <a href="/leads" style={{ color: 'var(--primary)' }}>Leads</a> and add a lead first.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Channel Partner (optional)</label>
            <select className="form-select" value={form.cp_id} onChange={e => setForm({ ...form, cp_id: e.target.value })}>
              <option value="">Direct Sale (no CP)</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.broker_name} — {p.agency_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Token Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                value={form.token_amount}
                onChange={e => setForm({ ...form, token_amount: e.target.value })}
                placeholder="e.g. 100000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Booking Date *</label>
              <input
                className="form-input"
                type="date"
                value={form.booking_date}
                onChange={e => setForm({ ...form, booking_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
