'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { IndianRupee, Users, Target, Globe, UserPlus, Smartphone, Footprints, Phone, Megaphone, Building, ClipboardList, Flame, Activity, Zap, Info } from 'lucide-react';
import StatCard from '@/components/StatCard';
import styles from './analytics.module.css';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sourceData, setSourceData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const [globalStats, setGlobalStats] = useState({
    totalPipeline: 0,
    avgConversion: 0,
    totalRevenue: 0,
    activeLeads: 0
  });

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      // 1. Fetch Leads data
      const { data: leads } = await supabase.from('leads').select('source, status, preferred_location, budget_max');
      
      const sourceMap = {};
      leads?.forEach(l => {
        if (!sourceMap[l.source]) sourceMap[l.source] = { source: l.source, total: 0, won: 0 };
        sourceMap[l.source].total++;
        if (l.status === 'won') sourceMap[l.source].won++;
      });
      
      const sources = Object.values(sourceMap).map(s => ({
        ...s,
        conversion_rate: ((s.won / s.total) * 100).toFixed(1)
      })).sort((a, b) => b.total - a.total);
      
      setSourceData(sources);

      // 2. Funnel Data
      const funnelOrder = ['new', 'contacted', 'qualified', 'negotiation', 'won'];
      const funnel = funnelOrder.map(status => {
        const count = leads?.filter(l => l.status === status).length || 0;
        return { 
          status, 
          count,
          percentage: leads?.length ? ((count / leads.length) * 100).toFixed(1) : 0
        };
      });
      setFunnelData(funnel);

      // 3. Team Stats & Revenue
      const { data: deals } = await supabase.from('deals').select('deal_value, stage');
      const totalRevenue = deals?.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + Number(d.deal_value || 0), 0) || 0;
      const pipelineValue = deals?.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((sum, d) => sum + Number(d.deal_value || 0), 0) || 0;
      const totalWon = leads?.filter(l => l.status === 'won').length || 0;
      const avgConv = leads?.length ? ((totalWon / leads.length) * 100).toFixed(1) : 0;

      setGlobalStats({
        totalRevenue,
        totalPipeline: pipelineValue,
        avgConversion: avgConv,
        activeLeads: leads?.filter(l => !['won', 'lost'].includes(l.status)).length || 0
      });

      // 4. Agent Leaderboard
      const { data: agentStats } = await supabase.from('profiles').select('id, full_name');
      const { data: dealStats } = await supabase.from('deal_stats').select('*');
      
      const leaderboard = agentStats?.map(a => {
        const stats = dealStats?.find(s => s.user_id === a.id) || {};
        return {
          name: a.full_name,
          revenue: stats.total_revenue || 0,
          deals: stats.won_deals || 0
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      
      setTeamPerformance(leaderboard || []);

      // 5. Property Demand Heatmap Data
      const locationMap = {};
      leads?.forEach(l => {
        if (!l.preferred_location) return;
        const loc = l.preferred_location.trim().toUpperCase();
        if (!locationMap[loc]) locationMap[loc] = { location: loc, count: 0, totalBudget: 0 };
        locationMap[loc].count++;
        locationMap[loc].totalBudget += Number(l.budget_max || 0);
      });

      const demand = Object.values(locationMap).map(loc => ({
        location: loc.location,
        inquiries: loc.count,
        avgBudget: loc.count > 0 ? (loc.totalBudget / loc.count) : 0
      })).sort((a, b) => b.inquiries - a.inquiries).slice(0, 8); // Top 8 locations
      
      setDemandData(demand);

    } catch (err) {
      console.error("Analytics Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const getSourceIcon = (source) => {
    const icons = { 
      website: <Globe size={14} />, 
      referral: <UserPlus size={14} />, 
      social_media: <Smartphone size={14} />, 
      walk_in: <Footprints size={14} />, 
      cold_call: <Phone size={14} />, 
      advertisement: <Megaphone size={14} />, 
      property_portal: <Building size={14} />, 
      other: <ClipboardList size={14} /> 
    };
    return icons[source] || <ClipboardList size={14} />;
  };

  if (loading) return <div className="p-8">Loading Analytics...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1>Analytics & Reporting</h1>
        <p className="text-muted">Comprehensive overview of your business performance</p>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon={<IndianRupee size={24} />} label="Total Revenue" value={formatCurrency(globalStats.totalRevenue)} color="success" delay={0} />
        <StatCard icon={<Activity size={24} />} label="Pipeline Value" value={formatCurrency(globalStats.totalPipeline)} color="primary" delay={100} />
        <StatCard icon={<Target size={24} />} label="Conversion Rate" value={`${globalStats.avgConversion}%`} color="warning" delay={200} />
        <StatCard icon={<Zap size={24} />} label="Active Leads" value={globalStats.activeLeads} color="accent" delay={300} />
      </div>

      <div className={styles.reportsGrid}>
        {/* Lead Source Performance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Lead Source Performance</h3>
            <span className={styles.percentageBadge}>ROI Focused</span>
          </div>
          <table className={styles.sourceTable}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Total Leads</th>
                <th>Won</th>
                <th>Conv. %</th>
              </tr>
            </thead>
            <tbody>
              {sourceData.map((s, i) => (
                <tr key={i}>
                  <td className={styles.sourceName}>
                    <span className={styles.sourceIcon}>{getSourceIcon(s.source)}</span>
                    {s.source.replace('_', ' ')}
                  </td>
                  <td>{s.total}</td>
                  <td>{s.won}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.conversion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Funnel Analytics */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Sales Funnel</h3>
            <span>Total Drop-off</span>
          </div>
          <div className={styles.funnelContainer}>
            {funnelData.map((step, i) => {
              // Calculate width relative to first step (Total)
              const maxWidth = funnelData[0].count || 1;
              const width = Math.max((step.count / maxWidth) * 100, 5);
              
              return (
                <div key={i} className={styles.funnelStep}>
                  <div className={styles.funnelLabel}>{step.status}</div>
                  <div className={styles.funnelBarWrapper}>
                    <div 
                      className={styles.funnelBar} 
                      style={{ 
                        width: `${width}%`,
                        opacity: 1 - (i * 0.15), // Fade effect for funnel
                      }}
                    >
                      {step.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '0 24px 24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Info size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Funnel represents the distribution of all leads across status stages.
          </div>
        </div>
      </div>

      <div className={styles.reportsGrid} style={{ marginTop: 24 }}>
        {/* Agent Leaderboard */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Top Performing Agents</h3>
            <span style={{ fontSize: '0.8rem' }}>By Revenue</span>
          </div>
          <div className={styles.leaderboardList}>
            {teamPerformance.map((agent, i) => (
              <div key={i} className={styles.leaderboardItem}>
                <div className={styles.rank}>#{i+1}</div>
                <div className={styles.agentInfo}>
                  <div className={styles.agentName}>{agent.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agent.deals} Deals Won</div>
                </div>
                <div className={styles.revenue}>{formatCurrency(agent.revenue)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Property Demand Heatmap */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Property Demand Heatmap</h3>
            <span style={{ fontSize: '0.8rem' }}>Top Micro-markets</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '0 24px 24px' }}>
            {demandData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No location data available in leads yet.</div>
            ) : (
              demandData.map((d, i) => {
                const maxInquiries = Math.max(...demandData.map(x => x.inquiries));
                const heatRatio = d.inquiries / maxInquiries;
                // Color intensity from light orange to dark red
                const heatColor = `rgba(255, ${150 - (heatRatio * 100)}, ${100 - (heatRatio * 80)}, 1)`;
                
                return (
                  <div key={i} style={{
                    background: heatColor,
                    color: heatRatio > 0.5 ? 'white' : 'var(--text-color)',
                    padding: '12px 16px',
                    borderRadius: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 140,
                    flex: '1 1 auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transition: 'transform 0.2s',
                    cursor: 'default'
                  }} className="heatmap-node">
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>{d.location}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}><Flame size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> {d.inquiries} Inquiries</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 4 }}>Avg Budget: {formatCurrency(d.avgBudget)}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      
      <div className={styles.reportsGrid} style={{ marginTop: 24 }}>
        {/* Quick Reports Info */}
        <div className={styles.card} style={{ 
          background: 'var(--primary)',
          color: 'white',
          padding: 30,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 15
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Weekly Reports Ready</h2>
          <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>
            Your automated summary for this week is generated. Lead volume is up 12% compared to last week.
          </p>
          <button className="btn" style={{ background: 'white', color: 'var(--primary)', fontWeight: 700 }}>
            Download PDF Report
          </button>
        </div>
      </div>
    </div>
  );
}
