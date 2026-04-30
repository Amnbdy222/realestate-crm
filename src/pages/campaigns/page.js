
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Megaphone, Plus, ArrowRight, Settings, Trash2 } from 'lucide-react';
import styles from './campaigns.module.css';
import Modal from '@/components/Modal';

export default function CampaignsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    if (user) loadCampaigns();
  }, [user]);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('drip_campaigns')
        .select('*, sequences:drip_sequences(*)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!form.name) return toast.warning('Name is required');
    try {
      const { error } = await supabase.from('drip_campaigns').insert({
        ...form,
        created_by: user.id
      });
      if (error) throw error;
      toast.success('Campaign created!');
      setIsModalOpen(false);
      setForm({ name: '', description: '' });
      loadCampaigns();
    } catch (err) {
      toast.error('Failed to create campaign');
    }
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign and all sequences? This will remove all leads enrolled in it.')) return;
    try {
      await supabase.from('drip_campaigns').delete().eq('id', id);
      toast.success('Campaign deleted');
      loadCampaigns();
    } catch (err) {
      toast.error('Failed to delete campaign');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Drip Campaigns</h1>
          <p className="text-muted">Automate your lead follow-up sequences</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Create Campaign
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <Megaphone size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>No campaigns yet</h3>
          <p className="text-muted">Create an automated sequence to engage your leads</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} onDelete={() => deleteCampaign(campaign.id)} onUpdate={loadCampaigns} />
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Campaign" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={createCampaign}>Create</button>
        </>
      }>
        <div className="form-group">
          <label className="form-label">Campaign Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Welcome Series" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} />
        </div>
      </Modal>
    </div>
  );
}

function CampaignCard({ campaign, onDelete, onUpdate }) {
  const toast = useToast();
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [stepForm, setStepForm] = useState({ delay_days: 1, channel: 'whatsapp', template_text: '' });

  const sortedSequences = [...(campaign.sequences || [])].sort((a, b) => a.step_number - b.step_number);

  const addStep = async () => {
    if (!stepForm.template_text) return toast.warning('Message template is required');
    try {
      const { error } = await supabase.from('drip_sequences').insert({
        campaign_id: campaign.id,
        step_number: sortedSequences.length + 1,
        delay_days: stepForm.delay_days,
        channel: stepForm.channel,
        template_text: stepForm.template_text
      });
      if (error) throw error;
      toast.success('Step added');
      setIsAddingStep(false);
      setStepForm({ delay_days: 1, channel: 'whatsapp', template_text: '' });
      onUpdate();
    } catch (err) {
      toast.error('Failed to add step');
    }
  };

  const deleteStep = async (stepId) => {
    if (!confirm('Delete this step?')) return;
    try {
      await supabase.from('drip_sequences').delete().eq('id', stepId);
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete step');
    }
  };

  return (
    <div className={styles.campaignCard}>
      <div className={styles.cardHeader}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px 0' }}>{campaign.name}</h3>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>{campaign.description || 'No description'}</p>
        </div>
        <button className="btn btn-ghost btn-sm text-danger" onClick={onDelete}><Trash2 size={16} /></button>
      </div>
      
      <div className={styles.sequences}>
        {sortedSequences.map((seq, idx) => (
          <div key={seq.id} className={styles.sequenceStep}>
            <div className={styles.stepConnector}>
              <div className={styles.stepDot}>{idx + 1}</div>
              {idx < sortedSequences.length - 1 && <div className={styles.stepLine} />}
            </div>
            <div className={styles.stepContent}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Wait {seq.delay_days} days</strong>
                <span className="badge badge-primary">{seq.channel}</span>
              </div>
              <p className={styles.stepTemplate}>{seq.template_text}</p>
              <button className={styles.deleteStepBtn} onClick={() => deleteStep(seq.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {!isAddingStep ? (
        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 16 }} onClick={() => setIsAddingStep(true)}>
          <Plus size={14} /> Add Step
        </button>
      ) : (
        <div className={styles.addStepForm}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Wait Days</label>
              <input type="number" min="0" className="form-input" style={{ padding: '6px' }} value={stepForm.delay_days} onChange={e => setStepForm({...stepForm, delay_days: parseInt(e.target.value)})} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Channel</label>
              <select className="form-select" style={{ padding: '6px' }} value={stepForm.channel} onChange={e => setStepForm({...stepForm, channel: e.target.value})}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Message Template</label>
            <textarea className="form-input" rows={2} style={{ padding: '6px', fontSize: '0.85rem' }} value={stepForm.template_text} onChange={e => setStepForm({...stepForm, template_text: e.target.value})} placeholder="Hi [Name], welcome..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={addStep} style={{ flex: 1 }}>Save Step</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setIsAddingStep(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
