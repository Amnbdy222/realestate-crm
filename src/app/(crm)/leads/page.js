'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Search, Flame, Snowflake, CircleDot, Sparkles, Home, Mic, Loader2, Users, Bot, Mail } from 'lucide-react';
import Modal from '@/components/Modal';
import VoiceRecorder from '@/components/VoiceRecorder';
import styles from './leads.module.css';
import { exportToCSV } from '@/lib/csvExport';
import Link from 'next/link';

const SOURCES = ['website', 'referral', 'social_media', 'walk_in', 'cold_call', 'advertisement', 'property_portal', 'other'];
const STATUSES = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PROPERTY_TYPES = ['residential', 'commercial', 'plot', 'villa', 'apartment', 'office', 'shop', 'other'];

const emptyLead = {
  full_name: '', email: '', phone: '', alternate_phone: '',
  source: 'walk_in', status: 'new', priority: 'medium',
  property_type: 'residential', budget_min: '', budget_max: '',
  preferred_location: '', assigned_to: '', notes: ''
};

export default function LeadsPage() {
  const { user, userProfile } = useAuth();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState({ ...emptyLead });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBudget, setFilterBudget] = useState('all');
  const [filterAiScore, setFilterAiScore] = useState('all');
  const [saving, setSaving] = useState(false);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  
  // Pagination
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  // Call Recording Upload State
  const [isUploadingCall, setIsUploadingCall] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && userProfile) {
      loadLeads();
      if (userProfile.role === 'admin') {
        loadAgents();
      }
    } else if (!user) {
      setLoading(false);
    }
  }, [user, userProfile, page]);

  // Real-time subscription: refresh current page when leads table changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, page]);

  const loadAgents = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('admin_id', user.id).eq('role', 'agent');
      setAgents(data || []);
    } catch (err) {
      // non-critical, agents list is optional
    }
  };

  const loadLeads = async () => {
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('leads')
        .select('*, follow_ups(*), assigned_profile:profiles(full_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;

      if (count !== null) setTotalCount(count);

      const scoredLeads = (data || []).map(lead => {
        let aiLabel = 'Cold';
        let aiColor = 'var(--danger)';
        
        if (lead.temperature === 'hot') { 
          aiLabel = 'Hot'; 
          aiColor = 'var(--success)'; 
        } else if (lead.temperature === 'warm') { 
          aiLabel = 'Warm'; 
          aiColor = 'var(--warning)'; 
        }

        return { 
          ...lead, 
          ai_score: lead.score || 0, 
          ai_label: aiLabel, 
          ai_color: aiColor 
        };
      });

      setLeads(scoredLeads);
    } catch (err) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingLead(null);
    setForm({ ...emptyLead });
    setModalOpen(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setForm({
      full_name: lead.full_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      alternate_phone: lead.alternate_phone || '',
      source: lead.source || 'walk_in',
      status: lead.status || 'new',
      priority: lead.priority || 'medium',
      property_type: lead.property_type || 'residential',
      budget_min: lead.budget_min || '',
      budget_max: lead.budget_max || '',
      preferred_location: lead.preferred_location || '',
      assigned_to: lead.assigned_to || '',
      notes: lead.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone) {
      toast.warning('Name and Phone are required');
      return;
    }
    setSaving(true);
    try {
      const leadData = { 
        ...form, 
        budget_min: Number(form.budget_min) || 0, 
        budget_max: Number(form.budget_max) || 0,
        assigned_to: form.assigned_to || null 
      };

      if (editingLead) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id);
        if (error) throw error;
        // Log status change if status changed
        if (leadData.status !== editingLead.status) {
          await logActivity(editingLead.id, 'status_change',
            `Status changed to ${leadData.status}`,
            `Previous: ${editingLead.status}`);
        }
        toast.success('Lead updated successfully');
      } else {
        // ── Deduplication check ──────────────────────────────
        const orFilter = form.email
          ? `phone.eq.${form.phone},email.eq.${form.email}`
          : `phone.eq.${form.phone}`;
        const { data: dupes } = await supabase
          .from('leads')
          .select('id, full_name, phone, email')
          .or(orFilter)
          .limit(1);

        if (dupes && dupes.length > 0) {
          const d = dupes[0];
          const proceed = confirm(
            `⚠️ Possible duplicate detected!\n\nExisting lead: ${d.full_name} (${d.phone}${d.email ? ' / ' + d.email : ''})\n\nDo you still want to add this lead?`
          );
          if (!proceed) { setSaving(false); return; }
        }
        // ────────────────────────────────────────────────────

        const { error } = await supabase
          .from('leads')
          .insert({ ...leadData, user_id: user.id });
        if (error) throw error;
        toast.success('Lead added successfully');
      }
      setModalOpen(false);
      loadLeads();
    } catch (err) {
      toast.error(err.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const [viewingLead, setViewingLead] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [leadTasks, setLeadTasks] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [viewTab, setViewTab] = useState('comms'); // 'comms' | 'activity' | 'tasks'
  
  const [composingEmail, setComposingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const openViewModal = async (lead) => {
    setViewingLead(lead);
    setViewTab('comms');
    loadCommunications(lead.id);
    loadActivities(lead.id);
    loadLeadTasks(lead.id);
    loadActiveCampaigns();
  };

  const loadActiveCampaigns = async () => {
    const { data } = await supabase.from('drip_campaigns').select('id, name').eq('is_active', true);
    setActiveCampaigns(data || []);
  };

  const enrollInCampaign = async () => {
    if (!selectedCampaign) return toast.warning('Select a campaign first');
    try {
      const { error } = await supabase.from('lead_campaigns').insert({
        lead_id: viewingLead.id,
        campaign_id: selectedCampaign,
        user_id: user.id,
        next_execution_time: new Date().toISOString() // schedule immediately for cron
      });
      if (error) throw error;
      toast.success('Lead enrolled in campaign successfully!');
      setSelectedCampaign('');
    } catch (err) {
      toast.error('Failed to enroll lead in campaign');
    }
  };

  const loadLeadTasks = async (leadId) => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    setLeadTasks(data || []);
  };

  const loadActivities = async (leadId) => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20);
    setActivities(data || []);
  };

  const loadCommunications = async (leadId) => {
    const { data } = await supabase.from('communications').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    setCommunications(data || []);
  };

  const handleCallUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !viewingLead) return;
    
    setIsUploadingCall(true);
    toast.info("Uploading and transcribing call...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('summarize_call', 'true');

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const summaryContent = `Call Recording Processed:\n\nTranscript Snippet: "${data.transcript.substring(0, 150)}..."\n\nAI Summary: ${data.extractedData?.summary}\n\nAction Items: ${(data.extractedData?.action_items || []).join(", ")}`;

      const { error } = await supabase.from('communications').insert([{
        lead_id: viewingLead.id,
        user_id: user.id,
        channel: 'whatsapp',
        direction: 'inbound',
        content: summaryContent,
        status: 'delivered'
      }]);

      if (error) throw error;
      
      toast.success('Call transcribed and summarized!');
      loadCommunications(viewingLead.id);
    } catch (err) {
      toast.error('Failed to transcribe call recording.');
    } finally {
      setIsUploadingCall(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendEmail = async () => {
    if (!emailSubject || !emailBody) return toast.warning('Subject and message are required');
    if (!viewingLead.email) return toast.warning('This lead does not have an email address');

    setSendingEmail(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: viewingLead.email,
          subject: emailSubject,
          message: emailBody,
          leadId: viewingLead.id,
          userId: user.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      
      toast.success('Email sent successfully!');
      setComposingEmail(false);
      setEmailSubject('');
      setEmailBody('');
      loadCommunications(viewingLead.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAiAssist = async (action) => {
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/leads/ai-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ lead: viewingLead, action })
      });
      const data = await res.json();
      
      if (action === 'score') {
        const { error } = await supabase.from('leads').update({ score: data.score, temperature: data.temperature }).eq('id', viewingLead.id);
        if (error) throw error;
        await logActivity(viewingLead.id, 'other', `AI scored as ${data.temperature} (${data.score})`);
        toast.success(`AI Scored: ${data.temperature} (${data.score})`);
        setViewingLead({ ...viewingLead, score: data.score, temperature: data.temperature });
        loadLeads();
      } else {
        const { error } = await supabase.from('communications').insert({
          lead_id: viewingLead.id,
          channel: 'whatsapp',
          direction: 'outbound',
          content: data.message,
          status: 'draft',
          is_automated: true
        });
        if (error) throw error;
        toast.success('AI Suggestion generated!');
        loadCommunications(viewingLead.id);
      }
    } catch (err) {
      toast.error('AI Assist failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const deleteLead = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    // Optimistic: remove from UI immediately
    setLeads(prev => prev.filter(l => l.id !== id));
    setTotalCount(prev => prev - 1);
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      toast.success('Lead deleted');
    } catch (err) {
      toast.error('Failed to delete lead');
      loadLeads(); // revert on failure
    }
  };

  // ── Bulk actions ──────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} leads? This cannot be undone.`)) return;
    const ids = [...selectedIds];
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setTotalCount(prev => prev - ids.length);
    setSelectedIds(new Set());
    try {
      const { error } = await supabase.from('leads').delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} leads deleted`);
    } catch {
      toast.error('Bulk delete failed');
      loadLeads();
    }
  };

  const bulkAssign = async () => {
    if (!bulkAssignTo) { toast.warning('Select an agent first'); return; }
    const ids = [...selectedIds];
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, assigned_to: bulkAssignTo } : l));
    setSelectedIds(new Set());
    try {
      const { error } = await supabase.from('leads').update({ assigned_to: bulkAssignTo }).in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} leads assigned`);
      setBulkAssignTo('');
    } catch {
      toast.error('Bulk assign failed');
      loadLeads();
    }
  };

  const handleExportCSV = () => {
    const toExport = selectedIds.size > 0
      ? filteredLeads.filter(l => selectedIds.has(l.id))
      : filteredLeads;

    const rows = toExport.map(l => ({
      Name: l.full_name,
      Phone: l.phone,
      Email: l.email || '',
      Source: l.source,
      Status: l.status,
      Priority: l.priority,
      'Property Type': l.property_type,
      'Budget Min': l.budget_min || 0,
      'Budget Max': l.budget_max || 0,
      Location: l.preferred_location || '',
      Notes: l.notes || '',
      'Created At': new Date(l.created_at).toLocaleDateString('en-IN'),
    }));
    exportToCSV(rows, `leads_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${rows.length} leads`);
  };
  // ──────────────────────────────────────────────────────────

  // ── Activity logging helper ───────────────────────────────
  const logActivity = async (leadId, type, title, description = '') => {
    try {
      await supabase.from('activities').insert({
        lead_id: leadId,
        activity_type: type,
        title,
        description,
        user_id: user.id,
      });
    } catch {
      // non-critical, don't block the main action
    }
  };
  // ─────────────────────────────────────────────────────────

  const handleVoiceLead = async (extractedData, transcript) => {
    try {
      const newLead = {
        full_name: extractedData?.full_name || 'Voice Lead (Needs Name)',
        phone: extractedData?.phone || '0000000000',
        email: extractedData?.email || null,
        budget_max: extractedData?.budget_max || 0,
        preferred_location: extractedData?.preferred_location || null,
        property_type: extractedData?.property_type || 'residential',
        notes: `Extracted from Voice Note: "${transcript}"\n\nAI Extracted Notes: ${extractedData?.notes || ''}`,
        source: 'walk_in',
        user_id: user.id
      };
      
      const { data, error } = await supabase.from('leads').insert([newLead]);
      if (error) throw error;
      
      toast.success('Lead created from voice note!');
      loadLeads();
    } catch (err) {
      toast.error('Failed to save voice lead to database.');
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) || l.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchesSource = filterSource === 'all' || l.source === filterSource;
    const matchesLocation = filterLocation === '' || l.preferred_location?.toLowerCase().includes(filterLocation.toLowerCase());
    
    let matchesBudget = true;
    if (filterBudget !== 'all') {
      const budget = Number(l.budget_max) || Number(l.budget_min) || 0;
      if (filterBudget === 'under_50l') matchesBudget = budget > 0 && budget < 5000000;
      else if (filterBudget === '50l_1cr') matchesBudget = budget >= 5000000 && budget <= 10000000;
      else if (filterBudget === 'above_1cr') matchesBudget = budget > 10000000;
    }

    const matchesAiScore = filterAiScore === 'all' || l.ai_label?.toLowerCase() === filterAiScore;

    return matchesSearch && matchesStatus && matchesSource && matchesLocation && matchesBudget && matchesAiScore;
  });

  const formatCurrency = (val) => val ? `₹${Number(val).toLocaleString('en-IN')}` : '-';
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Leads</h1>
          <p className="text-muted">Manage your incoming inquiries and prospects</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} title="Export to CSV">⬇ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Lead</button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <span><Search size={16} /></span>
          <input
            type="text"
            placeholder="Search by name, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
            style={{ width: 160 }}
          />
        </div>
        <div className={styles.searchBox}>
          <span>📍</span>
          <input
            type="text"
            placeholder="Location..."
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className={styles.searchInput}
            style={{ width: 120 }}
          />
        </div>
        <select className="form-select" value={filterBudget} onChange={e => { setFilterBudget(e.target.value); setPage(0); }} style={{ width: 140 }}>
          <option value="all">All Budgets</option>
          <option value="under_50l">Under 50L</option>
          <option value="50l_1cr">50L - 1Cr</option>
          <option value="above_1cr">Above 1Cr</option>
        </select>
        <select className="form-select" value={filterAiScore} onChange={e => { setFilterAiScore(e.target.value); setPage(0); }} style={{ width: 130 }}>
          <option value="all">AI Score (All)</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select className="form-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} style={{ width: 130 }}>
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="form-select" value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0); }} style={{ width: 130 }}>
          <option value="all">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--primary-glow)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
          animation: 'fadeInDown 0.2s ease',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
            {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {userProfile?.role === 'admin' && (
              <>
                <select
                  className="form-select"
                  value={bulkAssignTo}
                  onChange={e => setBulkAssignTo(e.target.value)}
                  style={{ width: 160, padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  <option value="">Assign to...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={bulkAssign} disabled={!bulkAssignTo}>
                  Assign
                </button>
              </>
            )}
            <button className="btn btn-danger btn-sm" onClick={bulkDelete}>Delete</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3>No leads found</h3>
            <p>{search || filterStatus !== 'all' || filterSource !== 'all' ? 'Try adjusting your filters' : 'Click "Add Lead" to get started'}</p>
          </div>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className={`data-table-wrapper ${styles.desktopTable}`}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                </th>
                <th>Lead</th>
                <th>AI Score</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Budget</th>
                <th>Assigned To</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, i) => (
                <tr key={lead.id} className="animate-fadeInUp" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards', background: selectedIds.has(lead.id) ? 'rgba(79,70,229,0.04)' : undefined }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 'var(--radius-md)',
                        background: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.8rem', color: 'white', flexShrink: 0
                      }}>
                        {lead.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.full_name}</span>
                    </div>
                  </td>
                  <td>
                    {lead.temperature ? (
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 4, 
                        padding: '4px 8px', borderRadius: 0, 
                        background: lead.temperature === 'hot' ? 'rgba(0, 184, 148, 0.1)' : lead.temperature === 'warm' ? 'rgba(253, 203, 110, 0.1)' : 'rgba(255, 107, 107, 0.1)', 
                        color: lead.temperature === 'hot' ? 'var(--success)' : lead.temperature === 'warm' ? 'var(--warning)' : 'var(--danger)', 
                        fontWeight: 600, fontSize: '0.75rem' 
                      }}>
                        {lead.temperature === 'hot' ? <Flame size={12} style={{display:'inline',verticalAlign:'middle',color:'#ff6b6b'}} /> : lead.temperature === 'warm' ? <CircleDot size={12} style={{display:'inline',verticalAlign:'middle',color:'#fdcb6e'}} /> : <Snowflake size={12} style={{display:'inline',verticalAlign:'middle',color:'#74b9ff'}} />} {lead.temperature} ({lead.score || 0})
                      </div>
                    ) : (
                      <span className="text-muted" style={{fontSize: '0.8rem'}}>Unscored</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{lead.phone}</span>
                      {lead.email && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.email}</span>}
                    </div>
                  </td>
                  <td><span style={{ textTransform: 'capitalize' }}>{lead.source?.replace(/_/g, ' ')}</span></td>
                  <td><span className={`badge badge-${lead.status}`}>{lead.status}</span></td>
                  <td><span className={`badge badge-priority-${lead.priority}`}>{lead.priority}</span></td>
                  <td>
                    {lead.budget_min || lead.budget_max ? (
                      lead.budget_min && lead.budget_max && lead.budget_min !== lead.budget_max
                        ? `${formatCurrency(lead.budget_min)} - ${formatCurrency(lead.budget_max)}`
                        : formatCurrency(lead.budget_max || lead.budget_min)
                    ) : '-'}
                  </td>
                  <td>
                    {lead.assigned_to 
                      ? (lead.assigned_profile?.full_name || 'Agent') 
                      : <span style={{color:'var(--text-muted)'}}>Unassigned</span>}
                  </td>
                  <td>{formatDate(lead.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openViewModal(lead)} title="View Details">👁️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(lead)} title="Edit">✏️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteLead(lead.id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className={styles.mobileCardList}>
          {filteredLeads.map((lead, i) => (
            <div key={lead.id} className={styles.mobileCard} style={{ animationDelay: `${i * 40}ms` }}>
              <div className={styles.mobileCardTop}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(lead.id)}
                  onChange={() => toggleSelect(lead.id)}
                  style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                />
                <div className={styles.mobileCardAvatar}>
                  {lead.full_name?.charAt(0).toUpperCase()}
                </div>
                <div className={styles.mobileCardInfo}>
                  <div className={styles.mobileCardName}>{lead.full_name}</div>
                  <div className={styles.mobileCardPhone}>{lead.phone}</div>
                </div>
                <div className={styles.mobileCardBadges}>
                  <span className={`badge badge-${lead.status}`}>{lead.status}</span>
                </div>
              </div>

              <div className={styles.mobileCardMeta}>
                <span className={styles.mobileCardMetaItem}>📍 {lead.preferred_location || 'No location'}</span>
                <span className={styles.mobileCardMetaItem}>🏷 {lead.source?.replace(/_/g, ' ')}</span>
                {(lead.budget_max > 0) && (
                  <span className={styles.mobileCardMetaItem}>💰 {formatCurrency(lead.budget_max)}</span>
                )}
                <span className={`badge badge-priority-${lead.priority}`}>{lead.priority}</span>
              </div>

              <div className={styles.mobileCardActions}>
                <button className="btn btn-secondary btn-sm" onClick={() => openViewModal(lead)}>👁 View</button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(lead)}>✏️ Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteLead(lead.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '12px 0' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} leads
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Prev
              </button>
              <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
              >
                Next →
              </button>
            </div>
          </div>
        )}
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLead ? 'Edit Lead' : 'Add New Lead'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingLead ? 'Update Lead' : 'Add Lead'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Enter full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select className="form-select" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Property Type</label>
            <select className="form-select" value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })}>
              {PROPERTY_TYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Budget Min (₹)</label>
            <input className="form-input" type="number" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Budget Max (₹)</label>
            <input className="form-input" type="number" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Preferred Location</label>
            <input className="form-input" value={form.preferred_location} onChange={e => setForm({ ...form, preferred_location: e.target.value })} placeholder="e.g., Sector 150, Noida" />
          </div>

          {userProfile?.role === 'admin' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Assign To Agent</label>
              <select className="form-select" value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">-- Unassigned (Keep to myself) --</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        title="Lead Smart Details"
        size="lg"
      >
        {viewingLead && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
            <div>
              <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 0, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0' }}>{viewingLead.full_name}</h3>
                <p className="text-muted" style={{ margin: 0 }}>{viewingLead.phone}</p>
                <div style={{ marginTop: 12 }}>
                  <span className={`badge badge-${viewingLead.status}`}>{viewingLead.status}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => handleAiAssist('score')} disabled={aiLoading}>
                  {aiLoading ? 'Analyzing...' : 'AI Lead Score'}
                </button>
                <button className="btn btn-secondary" onClick={() => handleAiAssist('suggest_followup')} disabled={aiLoading}>
                  {aiLoading ? 'Generating...' : <><Sparkles size={14} style={{display:'inline',verticalAlign:'middle'}} /> Draft WhatsApp Reply</>}
                </button>
                <button className="btn btn-secondary" onClick={() => handleAiAssist('recommend_properties')} disabled={aiLoading}>
                  {aiLoading ? 'Finding...' : <><Home size={14} style={{display:'inline',verticalAlign:'middle'}} /> Auto Recommend Properties</>}
                </button>
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <Link href="/tasks" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
                    Manage Tasks
                  </Link>

                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem' }}>Enroll in Campaign</h4>
                    <select className="form-select" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} style={{ marginBottom: 8, padding: '6px', fontSize: '0.85rem' }}>
                      <option value="">Select a campaign...</option>
                      {activeCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={enrollInCampaign} disabled={!selectedCampaign}>
                      Enroll Lead
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setViewTab('comms')}
                    style={{
                      padding: '6px 14px',
                      background: viewTab === 'comms' ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: viewTab === 'comms' ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Communications
                  </button>
                  <button
                    onClick={() => setViewTab('activity')}
                    style={{
                      padding: '6px 14px',
                      background: viewTab === 'activity' ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: viewTab === 'activity' ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Activity Log
                  </button>
                  <button
                    onClick={() => setViewTab('tasks')}
                    style={{
                      padding: '6px 14px',
                      background: viewTab === 'tasks' ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: viewTab === 'tasks' ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Tasks
                  </button>
                </div>
                {viewTab === 'comms' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setComposingEmail(!composingEmail)}>
                      <Mail size={14} style={{display:'inline',verticalAlign:'middle'}} /> {composingEmail ? 'Cancel Email' : 'Compose Email'}
                    </button>
                    <input type="file" accept="audio/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCallUpload} />
                    <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingCall}>
                      {isUploadingCall ? <><Loader2 size={14} style={{display:'inline',verticalAlign:'middle'}} /> Analyzing...</> : <><Mic size={14} style={{display:'inline',verticalAlign:'middle'}} /> Upload Call</>}
                    </button>
                  </div>
                )}
              </div>
              
              <div style={{ 
                border: '1px solid var(--border-color)', borderRadius: 0, height: 300, overflowY: 'auto', padding: 16,
                background: 'var(--bg-card)'
              }}>
                {viewTab === 'comms' ? (
                  composingEmail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {viewingLead.email ? (
                        <>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <input className="form-input" style={{ fontSize: '0.85rem', padding: '8px' }} placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                            <textarea className="form-input" style={{ fontSize: '0.85rem', padding: '8px', minHeight: '120px' }} placeholder="Type your message here..." value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleSendEmail} disabled={sendingEmail}>
                              {sendingEmail ? 'Sending...' : 'Send Email'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                          This lead does not have an email address. Please update their profile first.
                        </div>
                      )}
                    </div>
                  ) : communications.length === 0 ? (
                    <p className="text-muted">No communications yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {communications.map(msg => (
                        <div key={msg.id} style={{
                          padding: 12, borderRadius: 0,
                          background: msg.status === 'draft' ? 'rgba(253, 203, 110, 0.1)' : 'var(--bg-elevated)',
                          borderLeft: `4px solid ${msg.is_automated ? 'var(--primary)' : 'var(--success)'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
                            <strong>{msg.is_automated ? <><Bot size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Automated</> : 'Agent'} ({msg.channel})</strong>
                            <span className="text-muted">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg.content}</p>
                          {msg.status === 'draft' && (
                            <div style={{ marginTop: 8, textAlign: 'right' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)' }}>Pending Review</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : viewTab === 'activity' ? (
                  activities.length === 0 ? (
                    <p className="text-muted">No activity yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {activities.map(act => (
                        <div key={act.id} style={{
                          padding: 10,
                          borderLeft: '3px solid var(--primary)',
                          background: 'var(--bg-elevated)',
                          borderRadius: 0,
                        }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>{act.title}</div>
                          {act.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{act.description}</div>}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(act.created_at).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  leadTasks.length === 0 ? (
                    <p className="text-muted">No tasks for this lead.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {leadTasks.map(task => (
                        <div key={task.id} style={{ padding: 12, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                          <div style={{ fontWeight: 600, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            Priority: {task.priority} • Status: {task.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

