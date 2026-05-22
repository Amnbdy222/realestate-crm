'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Sparkles, Phone, Star, MessageSquare, Trophy, XCircle, IndianRupee, MapPin, MoveRight, X } from 'lucide-react';
import styles from './pipeline.module.css';

const STAGE_KEYS = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];
const STAGE_META = {
  new:         { label: 'New',         color: '#74B9FF' },
  contacted:   { label: 'Contacted',   color: '#A29BFE' },
  qualified:   { label: 'Qualified',   color: '#FDCB6E' },
  negotiation: { label: 'Negotiation', color: '#00D2FF' },
  won:         { label: 'Won',         color: '#00B894' },
  lost:        { label: 'Lost',        color: '#FF6B6B' },
};

const SCROLL_ZONE  = 120;
const SCROLL_SPEED = 14;

export default function PipelinePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead]     = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [selectedLead, setSelectedLead]   = useState(null);
  const [movingTo, setMovingTo]           = useState(null);
  const [collapsedStages, setCollapsedStages] = useState(new Set());

  const boardRef      = useRef(null);
  const scrollRafRef  = useRef(null);
  const isDraggingRef = useRef(false);
  const lastClientX   = useRef(0);

  const getIcon = (key) => {
    const icons = {
      new: <Sparkles size={16} />, contacted: <Phone size={16} />,
      qualified: <Star size={16} />, negotiation: <MessageSquare size={16} />,
      won: <Trophy size={16} />, lost: <XCircle size={16} />,
    };
    return icons[key] || null;
  };

  const toggleStage = (key) => {
    if (selectedLead) return;
    setCollapsedStages(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  useEffect(() => { if (user) loadLeads(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l));
        } else { loadLeads(); }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads').select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch { toast.error('Failed to load pipeline'); }
    finally { setLoading(false); }
  };

  // ── Auto-scroll loop ────────────────────────────────────
  const autoScrollLoop = useCallback(() => {
    const board = boardRef.current;
    if (!board || !isDraggingRef.current) return;
    const { left, right } = board.getBoundingClientRect();
    const x = lastClientX.current;
    const dL = x - left, dR = right - x;
    if (dL < SCROLL_ZONE) board.scrollLeft -= SCROLL_SPEED * (1 - dL / SCROLL_ZONE);
    else if (dR < SCROLL_ZONE) board.scrollLeft += SCROLL_SPEED * (1 - dR / SCROLL_ZONE);
    scrollRafRef.current = requestAnimationFrame(autoScrollLoop);
  }, []);

  const stopAutoScroll = useCallback(() => {
    isDraggingRef.current = false;
    if (scrollRafRef.current) { cancelAnimationFrame(scrollRafRef.current); scrollRafRef.current = null; }
  }, []);

  // ── Shared move ─────────────────────────────────────────
  const moveLead = useCallback(async (leadId, toStage) => {
    const cur = leads.find(l => l.id === leadId);
    if (!cur || cur.status === toStage) return;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: toStage } : l));
    try {
      const { error } = await supabase.from('leads').update({ status: toStage }).eq('id', leadId);
      if (error) throw error;
      toast.success(`Moved to ${toStage}`);
    } catch { toast.error('Failed to move lead'); loadLeads(); }
  }, [leads]);

  // ── Desktop drag ────────────────────────────────────────
  const handleDragStart = (e, lead) => {
    isDraggingRef.current = true;
    lastClientX.current = e.clientX;
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
    scrollRafRef.current = requestAnimationFrame(autoScrollLoop);
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    lastClientX.current = e.clientX;
    setDragOverStage(stageKey);
  };

  const handleDragEnd = () => { stopAutoScroll(); setDraggedLead(null); setDragOverStage(null); };

  const handleDrop = async (e, stageKey) => {
    e.preventDefault();
    stopAutoScroll();
    setDragOverStage(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) await moveLead(leadId, stageKey);
    setDraggedLead(null);
  };

  // ── Mobile tap ──────────────────────────────────────────
  const handleCardTap = (lead) => {
    if (selectedLead?.id === lead.id) { setSelectedLead(null); return; }
    setSelectedLead(lead);
    setCollapsedStages(new Set());
  };

  const handleStageTap = async (stageKey) => {
    if (!selectedLead) { toggleStage(stageKey); return; }
    if (selectedLead.status === stageKey) { setSelectedLead(null); return; }
    setMovingTo(stageKey);
    await moveLead(selectedLead.id, stageKey);
    setSelectedLead(null);
    setMovingTo(null);
  };

  const getLeadsByStage = (key) => leads.filter(l => l.status === key);

  const formatBudget = (val) => {
    if (!val) return '';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${(val / 1000).toFixed(0)}K`;
  };

  const getDaysAgo = (date) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? '1 day ago' : `${d} days ago`;
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            <span className={styles.desktopHint}>Drag & drop — board auto-scrolls near edges</span>
            <span className={styles.mobileHint}>Tap a card, then tap a stage to move it</span>
            {' '}— {leads.length} leads
          </p>
        </div>
        <a href="/leads" className="btn btn-primary">+ Add Lead</a>
      </div>

      {selectedLead && (
        <div className={styles.moveBanner}>
          <div className={styles.moveBannerLeft}>
            <MoveRight size={16} />
            <span>Moving <strong>{selectedLead.full_name}</strong> — tap a stage below</span>
          </div>
          <button className={styles.moveBannerCancel} onClick={() => setSelectedLead(null)}>
            <X size={16} /> Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.board}>
          {STAGE_KEYS.map(k => (
            <div key={k} className={styles.column}>
              <div className="skeleton" style={{ height: 44 }} />
              <div className="skeleton" style={{ height: 120, marginTop: 10 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.board} ref={boardRef} onMouseLeave={stopAutoScroll}>
          {STAGE_KEYS.map(key => {
            const stage        = STAGE_META[key];
            const stageLeads   = getLeadsByStage(key);
            const isOver       = dragOverStage === key;
            const isCollapsed  = collapsedStages.has(key);
            const isTarget     = selectedLead && selectedLead.status !== key;
            const isCurrent    = selectedLead?.status === key;
            const isMovingHere = movingTo === key;

            return (
              <div
                key={key}
                className={[
                  styles.column,
                  isOver      ? styles.columnDragOver  : '',
                  isCollapsed ? styles.columnCollapsed  : '',
                  isTarget    ? styles.columnTarget     : '',
                  isCurrent   ? styles.columnCurrent    : '',
                ].join(' ')}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => handleDrop(e, key)}
              >
                <div
                  className={`${styles.columnHeader} ${isTarget ? styles.columnHeaderTarget : ''}`}
                  onClick={() => handleStageTap(key)}
                >
                  <div className={styles.columnTitle}>
                    <span className={styles.columnIcon} style={{ background: `${stage.color}22`, color: stage.color }}>
                      {getIcon(key)}
                    </span>
                    <span>{stage.label}</span>
                    <span className={styles.count} style={{ background: `${stage.color}20`, color: stage.color }}>
                      {stageLeads.length}
                    </span>
                    {isTarget  && <span className={styles.moveHere}>{isMovingHere ? '⏳' : '→ Move here'}</span>}
                    {isCurrent && <span className={styles.currentStage}>Current</span>}
                    {!selectedLead && <span className={styles.collapseChevron}>{isCollapsed ? '▶' : '▼'}</span>}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className={styles.cardList}>
                    {stageLeads.length === 0 ? (
                      <div className={`${styles.emptyCol} ${isOver ? styles.emptyColOver : ''}`}>
                        <span style={{ opacity: 0.5 }}>
                          {isTarget ? 'Tap header to move here' : 'Drop leads here'}
                        </span>
                      </div>
                    ) : (
                      stageLeads.map((lead, i) => {
                        const isSel = selectedLead?.id === lead.id;
                        return (
                          <div
                            key={lead.id}
                            className={`${styles.leadCard} ${isSel ? styles.leadCardSelected : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleCardTap(lead)}
                            style={{ animationDelay: `${i * 60}ms`, borderLeftColor: isSel ? '#fff' : stage.color, cursor: 'grab' }}
                          >
                            <div className={styles.cardTop}>
                              <div className={styles.cardAvatar} style={{ background: isSel ? '#fff' : stage.color, color: isSel ? stage.color : '#fff' }}>
                                {lead.full_name?.charAt(0).toUpperCase()}
                              </div>
                              <div className={styles.cardInfo}>
                                <span className={styles.cardName}>{lead.full_name}</span>
                                <span className={styles.cardPhone}>{lead.phone}</span>
                              </div>
                              {isSel && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 99 }}>
                                  Selected
                                </span>
                              )}
                            </div>

                            <div className={styles.cardMeta}>
                              {lead.budget_max > 0 && (
                                <span className={styles.cardBudget}>
                                  <IndianRupee size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                  {formatBudget(lead.budget_max)}
                                </span>
                              )}
                              <span className={styles.cardSource}>{lead.source?.replace(/_/g, ' ')}</span>
                            </div>

                            {lead.preferred_location && (
                              <div className={styles.cardLocation}>
                                <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                {' '}{lead.preferred_location}
                              </div>
                            )}

                            <div className={styles.cardFooter}>
                              <span className={`badge badge-priority-${lead.priority}`}>{lead.priority}</span>
                              <span className={styles.cardDate}>{getDaysAgo(lead.created_at)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
