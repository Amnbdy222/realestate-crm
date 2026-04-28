-- ==========================================
-- REAL ESTATE CRM: DOCUMENT MANAGEMENT
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Create Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('kyc', 'agreement', 'invoice', 'proposal', 'other')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_signature', 'signed', 'approved', 'rejected')),
  
  file_url TEXT, -- URL to the file in Supabase Storage
  
  -- Links to CRM entities
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Create Storage Bucket for Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm_documents', 'crm_documents', false) -- Private bucket for security
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Authenticated users can upload/read their own files)
CREATE POLICY "Auth Users Upload Documents"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'crm_documents' );

CREATE POLICY "Auth Users Read Documents"
  ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'crm_documents' );

CREATE POLICY "Auth Users Update Documents"
  ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'crm_documents' );

CREATE POLICY "Auth Users Delete Documents"
  ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'crm_documents' );
