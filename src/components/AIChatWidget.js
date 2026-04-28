'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, X, ArrowUp } from 'lucide-react';
import styles from './AIChatWidget.module.css';

const PREWRITTEN_QUESTIONS = [
  "Summarize my active leads.",
  "What is the total value of my active projects?",
  "How many units are currently available?",
  "Do I have any follow-ups today?"
];

export default function AIChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI Assistant. How can I help you with your CRM today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [crmContext, setCrmContext] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      if (!crmContext && user) fetchContext();
    }
  }, [isOpen, messages]);

  const fetchContext = async () => {
    try {
      const { data: leads } = await supabase.from('leads').select('status');
      const { data: followups } = await supabase.from('follow_ups').select('follow_up_date, title');
      
      // Builder Module Data
      const { data: projects } = await supabase.from('projects').select('name, status');
      const { data: units } = await supabase.from('units').select('status, base_price, bhk_type');
      
      const activeLeads = leads?.filter(l => l.status !== 'won' && l.status !== 'lost').length || 0;
      const totalLeads = leads?.length || 0;
      
      const today = new Date().toDateString();
      const todaysFollowups = followups?.filter(f => new Date(f.follow_up_date).toDateString() === today).length || 0;

      const activeProjects = projects?.length || 0;
      const availableUnits = units?.filter(u => u.status === 'available').length || 0;
      const totalInventoryValue = units?.filter(u => u.status === 'available').reduce((sum, u) => sum + Number(u.base_price || 0), 0) || 0;

      const summary = `
- Total Leads: ${totalLeads}
- Active Leads: ${activeLeads}
- Follow-ups scheduled for today: ${todaysFollowups}

BUILDER INVENTORY STATUS:
- Total Projects: ${activeProjects}
- Available Units: ${availableUnits}
- Total Value of Available Inventory: ₹${totalInventoryValue.toLocaleString('en-IN')}
      `;
      setCrmContext(summary);
    } catch (err) {
      console.error("Failed to fetch CRM context for AI", err);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          messages: [...messages.slice(1), userMsg], // skip initial greeting
          context: crmContext
        })
      });

      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I ran into an error." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI service." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.widgetContainer}>
      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div className={styles.headerTitle}>
              <Sparkles size={18} /> AI Assistant
            </div>
            <button className={styles.closeButton} onClick={() => setIsOpen(false)}><X size={16} /></button>
          </div>
          
          <div className={styles.chatMessages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.message} ${styles[m.role]}`}>
                {m.content}
              </div>
            ))}
            
            {messages.length === 1 && (
              <div className={styles.prewrittenContainer}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Try asking:</p>
                {PREWRITTEN_QUESTIONS.map((q, i) => (
                  <button 
                    key={i} 
                    className={styles.prewrittenBtn}
                    onClick={() => sendMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.typingIndicator}>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.chatInputArea}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
              disabled={isLoading}
            />
            <button 
              className={styles.sendButton} 
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button className={styles.fab} onClick={() => setIsOpen(true)}>
          <Sparkles size={22} />
        </button>
      )}
    </div>
  );
}
