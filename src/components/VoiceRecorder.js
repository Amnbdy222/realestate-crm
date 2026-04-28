'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Mic, Square, Loader2 } from 'lucide-react';
import styles from './VoiceRecorder.module.css';

export default function VoiceRecorder({ onTranscriptionComplete }) {
  const toast = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const processAudio = async (blob) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const file = new File([blob], "voice_note.mp3", { type: 'audio/mp3' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('extract_lead', 'true');

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (onTranscriptionComplete) {
        onTranscriptionComplete(data.extractedData, data.transcript);
      }
      toast.success('Voice note processed!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process voice note.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      {!isRecording && !isProcessing && (
        <button className="btn" style={{ background: 'var(--primary)', color: 'white' }} onClick={startRecording}>
          <Mic size={16} style={{ marginRight: 8 }} /> Voice Add Lead
        </button>
      )}
      
      {isRecording && (
        <button className="btn" style={{ background: 'var(--danger)', color: 'white', animation: 'pulse 1.5s infinite' }} onClick={stopRecording}>
          <Square size={16} style={{ marginRight: 8 }} /> Stop Recording
        </button>
      )}

      {isProcessing && (
        <button className="btn btn-secondary" disabled>
          <Loader2 size={16} className="spin" style={{ marginRight: 8 }} /> Analyzing Voice...
        </button>
      )}
    </div>
  );
}
