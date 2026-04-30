
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Home, Building2, Ruler, Trees, Building, Briefcase, Store, HardHat, Search, MapPin, Maximize, BedDouble, Bath, Pencil, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import styles from './properties.module.css';

const TYPES = ['residential', 'commercial', 'plot', 'villa', 'apartment', 'office', 'shop', 'other'];
const PROP_STATUSES = ['available', 'sold', 'under_negotiation', 'rented', 'blocked'];

const emptyForm = {
  title: '', property_type: 'residential', status: 'available',
  address: '', city: '', state: '', pincode: '',
  area_sqft: '', bedrooms: '', bathrooms: '', price: '',
  description: '', image_url: ''
};

export default function PropertiesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBudget, setFilterBudget] = useState('all');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (user) loadProperties();
  }, [user]);

  const loadProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProperties(data || []);
    } catch (err) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setEditingProp(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (prop) => {
    setEditingProp(prop);
    setForm({
      title: prop.title || '', property_type: prop.property_type || 'residential',
      status: prop.status || 'available', address: prop.address || '',
      city: prop.city || '', state: prop.state || '', pincode: prop.pincode || '',
      area_sqft: prop.area_sqft || '', bedrooms: prop.bedrooms || '',
      bathrooms: prop.bathrooms || '', price: prop.price || '',
      description: prop.description || '', image_url: prop.image_url || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.address || !form.price) {
      toast.warning('Title, Address, and Price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        area_sqft: Number(form.area_sqft) || null,
        bedrooms: Number(form.bedrooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
      };
      if (editingProp) {
        const { error } = await supabase.from('properties').update(payload).eq('id', editingProp.id);
        if (error) throw error;
        toast.success('Property updated');
      } else {
        const { error } = await supabase.from('properties').insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success('Property added');
      }
      setModalOpen(false);
      loadProperties();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteProp = async (id) => {
    if (!confirm('Delete this property?')) return;
    // Optimistic: remove from UI immediately
    setProperties(prev => prev.filter(p => p.id !== id));
    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      toast.success('Property deleted');
    } catch (err) {
      toast.error('Failed to delete');
      loadProperties(); // revert on failure
    }
  };

  const handleImageUpload = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploadingImage(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('property_images')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage
        .from('property_images')
        .getPublicUrl(filePath);
        
      setForm({ ...form, image_url: data.publicUrl });
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Error uploading image');
    } finally {
      setUploadingImage(false);
    }
  };

  const filtered = properties.filter(p => {
    const matchesSearch = p.title?.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || p.property_type === filterType;
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchLocation = filterLocation === '' || p.city?.toLowerCase().includes(filterLocation.toLowerCase());
    
    let matchesBudget = true;
    if (filterBudget !== 'all') {
      const price = Number(p.price) || 0;
      if (filterBudget === 'under_50l') matchesBudget = price > 0 && price < 5000000;
      else if (filterBudget === '50l_1cr') matchesBudget = price >= 5000000 && price <= 10000000;
      else if (filterBudget === 'above_1cr') matchesBudget = price > 10000000;
    }

    return matchesSearch && matchType && matchStatus && matchLocation && matchesBudget;
  });

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    const num = Number(val);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const statusBadge = (status) => {
    const map = {
      available: 'badge-won', sold: 'badge-lost', under_negotiation: 'badge-negotiation',
      rented: 'badge-qualified', blocked: 'badge-missed'
    };
    return `badge ${map[status] || 'badge-new'}`;
  };

  const typeIcons = {
    residential: <Home size={20} />, commercial: <Building2 size={20} />, plot: <Ruler size={20} />, villa: <Trees size={20} />,
    apartment: <Building size={20} />, office: <Briefcase size={20} />, shop: <Store size={20} />, other: <HardHat size={20} />
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Properties</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Manage your property listings — {properties.length} total
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Property</button>
      </div>

      <div className={styles.filters}>
        <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 8 }}>
          <span><Search size={16} /></span>
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: 140, color: 'var(--text-primary)' }}
          />
        </div>
        <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 8 }}>
          <span><MapPin size={16} /></span>
          <input
            type="text"
            placeholder="City/Location..."
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: 120, color: 'var(--text-primary)' }}
          />
        </div>
        <select className="form-select" value={filterBudget} onChange={e => setFilterBudget(e.target.value)} style={{ width: 130 }}>
          <option value="all">All Prices</option>
          <option value="under_50l">Under 50L</option>
          <option value="50l_1cr">50L - 1Cr</option>
          <option value="above_1cr">Above 1Cr</option>
        </select>
        <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 130 }}>
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 130 }}>
          <option value="all">All Status</option>
          {PROP_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.propGrid}>{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 260 }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><span style={{ fontSize: '3rem' }}><Home size={48} /></span><h3>No properties found</h3><p>Add your first property listing</p></div></div>
      ) : (
        <div className={styles.propGrid}>
          {filtered.map((prop, i) => (
            <div key={prop.id} className={styles.propCard} style={{ animationDelay: `${i * 60}ms` }}>
              <div 
                className={styles.propImage} 
                style={prop.image_url ? { backgroundImage: `url(${prop.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
              >
                {!prop.image_url && <span className={styles.propTypeIcon}>{typeIcons[prop.property_type] || <HardHat size={20} />}</span>}
                <span className={statusBadge(prop.status)} style={{ position: 'absolute', top: 12, right: 12 }}>
                  {prop.status?.replace(/_/g, ' ')}
                </span>
              </div>

              <div className={styles.propBody}>
                <h4 className={styles.propTitle}>{prop.title}</h4>
                <p className={styles.propAddress}><MapPin size={12} style={{display:'inline',verticalAlign:'middle'}} /> {prop.address}{prop.city ? `, ${prop.city}` : ''}</p>
                
                <div className={styles.propPrice}>{formatCurrency(prop.price)}</div>

                <div className={styles.propDetails}>
                  {prop.area_sqft > 0 && <span><Maximize size={12} style={{display:'inline',verticalAlign:'middle'}} /> {prop.area_sqft} sqft</span>}
                  {prop.bedrooms > 0 && <span><BedDouble size={12} style={{display:'inline',verticalAlign:'middle'}} /> {prop.bedrooms} BHK</span>}
                  {prop.bathrooms > 0 && <span><Bath size={12} style={{display:'inline',verticalAlign:'middle'}} /> {prop.bathrooms} Bath</span>}
                </div>

                <div className={styles.propFooter}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {prop.property_type}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(prop)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteProp(prop.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProp ? 'Edit Property' : 'Add Property'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingProp ? 'Update' : 'Add Property'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Property Title *</label>
            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Luxury 3BHK in Sector 150" />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {PROP_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Address *</label>
            <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" />
          </div>
          <div className="form-group">
            <label className="form-label">Price (₹) *</label>
            <input className="form-input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g., 7500000" />
          </div>
          <div className="form-group">
            <label className="form-label">Area (sqft)</label>
            <input className="form-input" type="number" value={form.area_sqft} onChange={e => setForm({ ...form, area_sqft: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Bedrooms</label>
            <input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Bathrooms</label>
            <input className="form-input" type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Property description..." />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Property Image</label>
            <input 
              type="file" 
              accept="image/*" 
              className="form-input" 
              onChange={handleImageUpload} 
              disabled={uploadingImage}
            />
            {uploadingImage && <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: 4 }}>Uploading image...</div>}
            {form.image_url && (
              <div style={{ marginTop: '12px' }}>
                <img src={form.image_url} alt="Property Preview" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: 0, border: '1px solid var(--border)' }} />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
