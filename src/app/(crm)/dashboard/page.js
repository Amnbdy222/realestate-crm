'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Users, Handshake, IndianRupee, TrendingUp, Globe, UserPlus, Smartphone, Footprints, Phone, Megaphone, Building, ClipboardList, Crosshair, Sparkles, ArrowRight } from 'lucide-react';
import StatCard from '@/components/StatCard';
import styles from './dashboard.module.css';

// ─── Module-level cache ───────────────────────────────────────────────────────
// Persists across client-side navigation so cached data shows instantly.
let dashboardFetchLock = false;
let dashboardCache = null; // { stats, recentLeads, upcomingFollowups, recentProperties }

// ─── Helper: compute derived stats from raw data ─────────────────────────────
function computeDashboard(leads = [], deals = [], followups = [], properties = []) {
  const wonLeads    = leads.filter(l => l.status === 'won').length;
  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const pipelineValue  = activeDeals.reduce((sum, d) => sum + Number(d.deal_value || 0), 0);
  const conversionRate = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : 0;
  return {
    stats: { totalLeads: leads.length, activeDeals: activeDeals.length, pipelineValue, conversionRate },
    recentLeads: leads.slice(0, 6),
    upcomingFollowups: followups,
    recentProperties: properties,
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  // Initialise from cache so navigating back shows data instantly — no skeleton
  const [stats, setStats]                         = useState(dashboardCache?.stats      ?? { totalLeads: 0, activeDeals: 0, pipelineValue: 0, conversionRate: 0 });
  const [recentLeads, setRecentLeads]             = useState(dashboardCache?.recentLeads ?? []);
  const [upcomingFollowups, setUpcomingFollowups] = useState(dashboardCache?.upcomingFollowups ?? []);
  const [recentProperties, setRecentProperties]   = useState(dashboardCache?.recentProperties  ?? []);
  const [aiInsights, setAiInsights]               = useState(null);
  const [isGeneratingAI, setIsGeneratingAI]       = useState(false);
  // Only show skeleton on first-ever load (cache empty); subsequent navigations show stale data immediately
  const [loading, setLoading] = useState(!dashboardCache);

  // ── Apply a full data set to state + cache ──────────────────────────────────
  const applyData = (leads, deals, followups, properties, isMounted) => {
    if (!isMounted) return;
    const d = computeDashboard(leads, deals, followups, properties);
    dashboardCache = d;
    setStats(d.stats);
    setRecentLeads(d.recentLeads);
    setUpcomingFollowups(d.upcomingFollowups);
    setRecentProperties(d.recentProperties);
  };

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }

    let isMounted = true;
    const controller = new AbortController();
    const sig = controller.signal;

    // ── Initial fetch (stale-while-revalidate) ────────────────────────────────
    const fetchAll = async () => {
      if (!isMounted || dashboardFetchLock) return;
      dashboardFetchLock = true;

      // Don't show skeleton if we already have cached data
      if (!dashboardCache) setLoading(true);

      try {
        await new Promise(r => setTimeout(r, 50)); // let Strict Mode cleanup fire first
        if (!isMounted) return;

        const [
          { data: leads },
          { data: deals },
          { data: followups },
          { data: properties },
        ] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }).abortSignal(sig),
          supabase.from('deals').select('*').abortSignal(sig),
          supabase.from('follow_ups').select('*, leads(full_name)').eq('status', 'pending').gte('follow_up_date', new Date().toISOString()).order('follow_up_date', { ascending: true }).limit(5).abortSignal(sig),
          supabase.from('properties').select('*').order('created_at', { ascending: false }).limit(4).abortSignal(sig),
        ]);

        applyData(leads || [], deals || [], followups || [], properties || [], isMounted);
      } catch (err) {
        if (sig.aborted) return;
        console.error('[Dashboard] Fetch error:', err);
        if (isMounted) toast?.error?.('Could not load dashboard data.');
      } finally {
        dashboardFetchLock = false;
        if (isMounted) setLoading(false);
      }
    };

    fetchAll();

    // ── Supabase Realtime subscriptions ───────────────────────────────────────
    // Any INSERT / UPDATE / DELETE on these tables triggers a silent background re-fetch.
    let realtimeLeads = [], realtimeDeals = [], realtimeFollowups = [], realtimeProperties = [];

    // Cache a local snapshot for realtime delta updates
    const snap = dashboardCache;
    if (snap) {
      realtimeLeads      = [...snap.recentLeads];
      realtimeDeals      = [];  // will be patched by realtime
      realtimeFollowups  = [...snap.upcomingFollowups];
      realtimeProperties = [...snap.recentProperties];
    }

    const silentRefetch = async () => {
      if (!isMounted || sig.aborted) return;
      try {
        const [{ data: l }, { data: d }, { data: f }, { data: p }] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('deals').select('*'),
          supabase.from('follow_ups').select('*, leads(full_name)').eq('status', 'pending').gte('follow_up_date', new Date().toISOString()).order('follow_up_date', { ascending: true }).limit(5),
          supabase.from('properties').select('*').order('created_at', { ascending: false }).limit(4),
        ]);
        applyData(l || [], d || [], f || [], p || [], isMounted);
      } catch { /* silent — realtime is best-effort */ }
    };

    const channel = supabase
      .channel(`dashboard-realtime-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' },      () => silentRefetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' },      () => silentRefetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, () => silentRefetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => silentRefetch())
      .subscribe();

    // ── Re-fetch on tab focus after inactivity ────────────────────────────────
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMounted && !dashboardFetchLock) fetchAll();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      dashboardFetchLock = false;
      controller.abort();
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id]);



  const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => `badge badge-${status}`;
  const getSourceIcon = (source) => {
    const icons = { website: <Globe size={14} />, referral: <UserPlus size={14} />, social_media: <Smartphone size={14} />, walk_in: <Footprints size={14} />, cold_call: <Phone size={14} />, advertisement: <Megaphone size={14} />, property_portal: <Building size={14} />, other: <ClipboardList size={14} /> };
    return icons[source] || <ClipboardList size={14} />;
  };

  const generateAIInsights = async () => {
    setIsGeneratingAI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          stats,
          recentLeads: recentLeads.map(l => ({ full_name: l.full_name, status: l.status })),
          upcomingFollowups: upcomingFollowups.map(f => ({ 
            title: f.title, 
            follow_up_date: f.follow_up_date, 
            leads: { full_name: f.leads?.full_name } 
          }))
        })
      });
      
      const data = await response.json();
      if (data.insights) {
        // Parse bullet points from text
        const bullets = data.insights.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-*•]\s*/, '').trim());
        setAiInsights(bullets);
      } else {
        throw new Error(data.error || 'Failed to generate insights');
      }
    } catch (error) {
      setAiInsights(['Could not connect to AI service. Please try again.']);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 style={{ marginBottom: 24 }}>Dashboard</h1>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 130, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    );
  }

  const todaysVisits = upcomingFollowups.filter(f => 
    f.follow_up_type === 'site_visit' && 
    new Date(f.follow_up_date).toDateString() === new Date().toDateString()
  );

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back! Here&apos;s your real estate overview.</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/leads" className="btn btn-primary">+ Add Lead</a>
        </div>
      </div>

      {todaysVisits.length > 0 && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--text-primary)',
          fontWeight: '500',
          animation: 'fadeInUp 0.4s ease backwards'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔔</span>
          <div>
            <strong>Reminder:</strong> You have {todaysVisits.length} site visit{todaysVisits.length > 1 ? 's' : ''} scheduled for today. 
            <a href="/followups" style={{ marginLeft: 8, color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>View Calendar →</a>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <StatCard icon={<Users size={24} />} label="Total Leads" value={stats.totalLeads} trend="+12% this month" trendUp={true} color="primary" delay={0} />
        <StatCard icon={<Handshake size={24} />} label="Active Deals" value={stats.activeDeals} trend="3 closing soon" trendUp={true} color="accent" delay={100} />
        <StatCard icon={<IndianRupee size={24} />} label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} trend="+8% growth" trendUp={true} color="success" delay={200} />
        <StatCard icon={<TrendingUp size={24} />} label="Conversion Rate" value={`${stats.conversionRate}%`} trend="Above average" trendUp={true} color="warning" delay={300} />
      </div>

      {/* AI Insights Card */}
      <div className={styles.aiCard}>
        <div className={styles.aiHeader}>
          <h3><Sparkles size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /> AI Assistant Insights</h3>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={generateAIInsights} 
            disabled={isGeneratingAI}
            style={{ borderRadius: 'var(--radius-full)', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            {isGeneratingAI ? 'Generating...' : aiInsights ? 'Refresh Insights' : 'Generate Insights'}
          </button>
        </div>
        
        <div className={styles.aiContent}>
          {isGeneratingAI ? (
            <div className={styles.aiLoading}>
              <div className={styles.spinner}></div>
              <span>Analyzing your CRM data...</span>
            </div>
          ) : aiInsights ? (
            <ul className={styles.aiList}>
              {aiInsights.map((insight, i) => (
                <li key={i} className={styles.aiListItem} style={{ animationDelay: `${i * 100}ms` }}>
                  <span><Crosshair size={16} /></span>
                  <div>{insight}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Click &quot;Generate Insights&quot; to get personalized, AI-driven recommendations based on your pipeline and follow-ups.
            </div>
          )}
        </div>
      </div>

      <div className={styles.grid2} style={{ marginTop: 24 }}>
        {/* Recent Leads */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3>Recent Leads</h3>
            <a href="/leads" className="btn btn-ghost btn-sm">View All <ArrowRight size={14} style={{ marginLeft: 4 }} /></a>
          </div>
          {recentLeads.length === 0 ? (
            <div className="empty-state">
              <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <h3>No leads yet</h3>
              <p>Start adding leads to see them here</p>
            </div>
          ) : (
            <div className={styles.leadList}>
              {recentLeads.map((lead, i) => (
                <div key={lead.id} className={styles.leadItem} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={styles.leadAvatar}>
                    {lead.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.leadInfo}>
                    <span className={styles.leadName}>{lead.full_name}</span>
                    <span className={styles.leadMeta}>
                      {getSourceIcon(lead.source)} {lead.source?.replace('_', ' ')} • {lead.phone}
                    </span>
                  </div>
                  <div>
                    <span className={getStatusBadge(lead.status)}>{lead.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Follow-ups */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3>Upcoming Follow-ups</h3>
            <a href="/followups" className="btn btn-ghost btn-sm">View All →</a>
          </div>
          {upcomingFollowups.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '2.5rem' }}>📅</span>
              <h3>No upcoming follow-ups</h3>
              <p>Schedule follow-ups to stay on track</p>
            </div>
          ) : (
            <div className={styles.followupList}>
              {upcomingFollowups.map((fu, i) => (
                <div key={fu.id} className={styles.followupItem} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={styles.followupDate}>
                    <span className={styles.fuDay}>{new Date(fu.follow_up_date).getDate()}</span>
                    <span className={styles.fuMonth}>{new Date(fu.follow_up_date).toLocaleString('en', { month: 'short' })}</span>
                  </div>
                  <div className={styles.followupInfo}>
                    <span className={styles.fuTitle}>{fu.title}</span>
                    <span className={styles.fuMeta}>
                      {fu.leads?.full_name} • {fu.follow_up_type?.replace('_', ' ')}
                    </span>
                  </div>
                  <span className={`badge badge-${fu.status}`}>{fu.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Properties Section */}
      <div className={`card ${styles.section}`} style={{ marginTop: 24 }}>
        <div className={styles.sectionHeader}>
          <h3>Recent Properties</h3>
          <a href="/properties" className="btn btn-ghost btn-sm">View All Properties <ArrowRight size={14} style={{ marginLeft: 4 }} /></a>
        </div>
        
        {recentProperties.length === 0 ? (
          <div className="empty-state">
            <Building size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <h3>No properties listed</h3>
            <p>Start adding properties to showcase them here</p>
          </div>
        ) : (
          <div className={styles.propertyGrid}>
            {recentProperties.map((prop, i) => (
              <div key={prop.id} className={styles.propertyItem} style={{ animationDelay: `${i * 100}ms` }}>
                <div className={styles.propertyImage}>
                  {prop.image_url ? (
                    <img src={prop.image_url} alt={prop.title} />
                  ) : (
                    <div className={styles.propertyImagePlaceholder}>
                      <Building size={24} />
                    </div>
                  )}
                  <span className={`${styles.propertyStatus} badge badge-${prop.status}`}>
                    {prop.status}
                  </span>
                </div>
                <div className={styles.propertyDetails}>
                  <h4 className={styles.propertyTitle}>{prop.title}</h4>
                  <p className={styles.propertyAddress}>{prop.city}, {prop.state}</p>
                  <div className={styles.propertyPrice}>
                    {formatCurrency(prop.price)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline Summary */}
      <div className={`card ${styles.section}`} style={{ marginTop: 20 }}>
        <div className={styles.sectionHeader}>
          <h3>Lead Pipeline Summary</h3>
          <a href="/pipeline" className="btn btn-ghost btn-sm">Open Pipeline →</a>
        </div>
        <div className={styles.pipelineBar}>
          {['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'].map(stage => {
            const count = recentLeads.filter(l => l.status === stage).length;
            const total = recentLeads.length || 1;
            const pct = ((count / total) * 100).toFixed(0);
            return (
              <div key={stage} className={styles.pipelineStage}>
                <div className={styles.pipelineStageBar}>
                  <div
                    className={`${styles.pipelineFill} ${styles[`fill_${stage}`]}`}
                    style={{ width: `${Math.max(pct, 5)}%` }}
                  />
                </div>
                <div className={styles.pipelineLabel}>
                  <span>{stage}</span>
                  <span className={styles.pipelineCount}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
