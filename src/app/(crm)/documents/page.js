'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { 
  Fingerprint, 
  Handshake, 
  Receipt, 
  FileText, 
  Paperclip, 
  Sparkles, 
  Upload, 
  FolderOpen, 
  Check, 
  Download, 
  FileSignature 
} from 'lucide-react';
import Modal from '@/components/Modal';
import styles from './documents.module.css';

export default function DocumentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  
  // Forms
  const fileInputRef = useRef(null);
  const [uploadForm, setUploadForm] = useState({ title: '', type: 'kyc', file: null });
  const [generateForm, setGenerateForm] = useState({ title: '', type: 'agreement', clientName: '', propertyAddress: '', amount: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') { // Ignore relation does not exist if migration not run yet
        throw error;
      }
      setDocuments(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadForm.file || !uploadForm.title) {
      toast.warning('Please provide a title and select a file');
      return;
    }

    setSaving(true);
    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${uploadForm.type}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('crm_documents')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL (or signed URL if private, but for simplicity assuming we can get a signed URL later, storing path)
      
      // 3. Save to database
      const { error: dbError } = await supabase
        .from('documents')
        .insert([{
          title: uploadForm.title,
          document_type: uploadForm.type,
          status: uploadForm.type === 'agreement' ? 'pending_signature' : 'approved',
          file_url: filePath,
          user_id: user.id
        }]);

      if (dbError) throw dbError;

      toast.success('Document uploaded successfully');
      setUploadModalOpen(false);
      setUploadForm({ title: '', type: 'kyc', file: null });
      loadDocuments();
    } catch (err) {
      toast.error(err.message || 'Upload failed. Did you run the SQL migration?');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDocument = async () => {
    if (!generateForm.title || !generateForm.clientName) {
      toast.warning('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      // Create a simple HTML agreement
      const content = `
        <h1>Real Estate Agreement: ${generateForm.title}</h1>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Client Name:</strong> ${generateForm.clientName}</p>
        <p><strong>Property Address:</strong> ${generateForm.propertyAddress}</p>
        <p><strong>Agreed Amount:</strong> ₹${generateForm.amount}</p>
        <br/><br/>
        <p>This is an automatically generated document.</p>
        <hr/>
        <p>Signature: _______________________</p>
      `;

      const blob = new Blob([content], { type: 'text/html' });
      const file = new File([blob], `${generateForm.title.replace(/\s+/g, '_')}.html`, { type: 'text/html' });
      
      const fileName = `${user.id}_${Date.now()}.html`;
      const filePath = `generated/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('crm_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('documents')
        .insert([{
          title: generateForm.title,
          document_type: generateForm.type,
          status: 'pending_signature',
          file_url: filePath,
          user_id: user.id
        }]);

      if (dbError) throw dbError;

      toast.success('Document generated successfully');
      setGenerateModalOpen(false);
      setGenerateForm({ title: '', type: 'agreement', clientName: '', propertyAddress: '', amount: '' });
      loadDocuments();
    } catch (err) {
      toast.error(err.message || 'Generation failed. Did you run the SQL migration?');
    } finally {
      setSaving(false);
    }
  };

  const handleSignDocument = async (id) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'signed' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Document digitally signed!');
      loadDocuments();
    } catch (err) {
      toast.error('Failed to sign document');
    }
  };

  const handleDownload = async (filePath, title) => {
    try {
      const { data, error } = await supabase.storage.from('crm_documents').download(filePath);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = title;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download file');
    }
  };

  const filteredDocs = filter === 'all' ? documents : documents.filter(d => d.document_type === filter);

  const getDocIcon = (type) => {
    const icons = { 
      kyc: <Fingerprint size={20} />, 
      agreement: <Handshake size={20} />, 
      invoice: <Receipt size={20} />, 
      proposal: <FileText size={20} />, 
      other: <Paperclip size={20} /> 
    };
    return icons[type] || <Paperclip size={20} />;
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Document Management</h1>
          <p className="text-muted">Manage KYC, generate agreements, and track digital signatures.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setGenerateModalOpen(true)}>
            <Sparkles size={16} style={{ marginRight: 8 }} /> Auto-Generate
          </button>
          <button className="btn btn-primary" onClick={() => setUploadModalOpen(true)}>
            <Upload size={16} style={{ marginRight: 8 }} /> Upload File
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        {['all', 'kyc', 'agreement', 'invoice', 'proposal'].map(f => (
          <button 
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 0 }} />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="empty-state card">
          <FolderOpen size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>No documents found</h3>
          <p>Upload a file or generate a new agreement to get started.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredDocs.map((doc, i) => (
            <div key={doc.id} className={styles.docCard} style={{ animationDelay: `${i * 50}ms` }}>
              <div className={styles.docHeader}>
                <div className={styles.docIcon}>{getDocIcon(doc.document_type)}</div>
                <span className={`${styles.badge} ${styles['status_' + doc.status]}`}>
                  {doc.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className={styles.docInfo}>
                <h3 className={styles.docTitle}>{doc.title}</h3>
                <div className={styles.docMeta}>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span style={{ textTransform: 'capitalize' }}>{doc.document_type}</span>
                </div>
              </div>

              <div className={styles.docActions}>
                {doc.status === 'pending_signature' ? (
                  <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => handleSignDocument(doc.id)}>
                    <FileSignature size={14} style={{ marginRight: 6 }} /> E-Sign
                  </button>
                ) : (
                  <button className={styles.actionBtn} disabled style={{ opacity: 0.5 }}>
                    <Check size={14} style={{ marginRight: 6 }} /> Signed
                  </button>
                )}
                <button className={styles.actionBtn} onClick={() => handleDownload(doc.file_url, doc.title)}>
                  <Download size={14} style={{ marginRight: 6 }} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Document" size="md" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setUploadModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleFileUpload} disabled={saving || !uploadForm.file}>
            {saving ? 'Uploading...' : 'Upload File'}
          </button>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Document Title</label>
            <input className="form-input" value={uploadForm.title} onChange={e => setUploadForm({...uploadForm, title: e.target.value})} placeholder="e.g. John Doe Passport" />
          </div>
          <div className="form-group">
            <label className="form-label">Document Type</label>
            <select className="form-input" value={uploadForm.type} onChange={e => setUploadForm({...uploadForm, type: e.target.value})}>
              <option value="kyc">KYC (ID Proof, Address)</option>
              <option value="agreement">Agreement / Contract</option>
              <option value="invoice">Invoice</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">File</label>
            <div 
              className={styles.fileUploadArea}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>{uploadForm.file ? uploadForm.file.name : 'Click to select a PDF or Image'}</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={e => setUploadForm({...uploadForm, file: e.target.files[0]})}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Generate Modal */}
      <Modal isOpen={generateModalOpen} onClose={() => setGenerateModalOpen(false)} title="Auto-Generate Agreement" size="md" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setGenerateModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerateDocument} disabled={saving}>
            {saving ? 'Generating...' : 'Generate & Save'}
          </button>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Agreement Title</label>
            <input className="form-input" value={generateForm.title} onChange={e => setGenerateForm({...generateForm, title: e.target.value})} placeholder="e.g. Sale Agreement - Villa 42" />
          </div>
          <div className="form-group">
            <label className="form-label">Client Name</label>
            <input className="form-input" value={generateForm.clientName} onChange={e => setGenerateForm({...generateForm, clientName: e.target.value})} placeholder="e.g. Sarah Connor" />
          </div>
          <div className="form-group">
            <label className="form-label">Property Address</label>
            <input className="form-input" value={generateForm.propertyAddress} onChange={e => setGenerateForm({...generateForm, propertyAddress: e.target.value})} placeholder="e.g. 123 Tech Lane" />
          </div>
          <div className="form-group">
            <label className="form-label">Deal Amount (₹)</label>
            <input className="form-input" type="number" value={generateForm.amount} onChange={e => setGenerateForm({...generateForm, amount: e.target.value})} placeholder="e.g. 5000000" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
