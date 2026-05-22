'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { IndianRupee, Users, TrendingUp, Briefcase, Trophy, Target, Search } from 'lucide-react';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';

export default function TeamPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' or 'performance'
  const [performanceData, setPerformanceData] = useState({});
  const [teamStats, setTeamStats] = useState({
    totalRevenue: 0,
    totalLeads: 0,
    totalWon: 0,
    avgConversion: 0
  });
  
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: ''
  });
  const [saving, setSaving] = useState(false);

  // Gamification & Leaderboard States
  const [sortBy, setSortBy] = useState('revenue'); // 'revenue', 'conversion', 'leads'
  const [searchTerm, setSearchTerm] = useState('');

  // Agency Goal Configuration (₹5 Crore)
  const agencyTarget = 50000000;

  // Calculate global revenue ranks for dynamic medals
  const getRevenueRanks = () => {
    const sortedByRevenue = [...agents].sort((a, b) => {
      const perfA = performanceData[a.id] || {};
      const perfB = performanceData[b.id] || {};
      return Number(perfB.total_revenue || 0) - Number(perfA.total_revenue || 0);
    });

    const ranks = {};
    sortedByRevenue.forEach((agent, index) => {
      ranks[agent.id] = index + 1;
    });
    return ranks;
  };

  const revenueRanks = getRevenueRanks();

  const renderRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '1.25rem', animation: 'float 3s infinite ease-in-out', display: 'inline-block' }} title="Top Performer Crown">👑</span>
          <span style={{ fontSize: '1.1rem' }} title="Gold Medal">🥇</span>
        </div>
      );
    }
    if (rank === 2) {
      return <span style={{ fontSize: '1.1rem' }} title="Silver Medal">🥈</span>;
    }
    if (rank === 3) {
      return <span style={{ fontSize: '1.1rem' }} title="Bronze Medal">🥉</span>;
    }
    return (
      <span style={{
        fontSize: '0.78rem',
        fontWeight: 700,
        color: 'var(--text-secondary)',
        background: 'var(--bg-secondary)',
        padding: '2px 8px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)'
      }}>
        #{rank}
      </span>
    );
  };

  const getAchievementBadges = (perf, rank) => {
    const badges = [];
    
    if (rank === 1 && Number(perf.total_revenue || 0) > 0) {
      badges.push({
        text: 'Top Performer',
        icon: '👑',
        bgColor: 'rgba(79, 70, 229, 0.08)',
        color: 'var(--primary)',
        borderColor: 'rgba(79, 70, 229, 0.2)'
      });
    }
    
    const convRate = Number(perf.conversion_rate || 0);
    const wonLeads = Number(perf.won_leads || 0);
    if (convRate > 20 && wonLeads > 0) {
      badges.push({
        text: 'Lightning Closer',
        icon: '⚡',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        color: 'var(--warning)',
        borderColor: 'rgba(245, 158, 11, 0.2)'
      });
    }
    
    const totalLeads = Number(perf.total_leads || 0);
    if (totalLeads > 5) {
      badges.push({
        text: 'Prospecting Titan',
        icon: '🔥',
        bgColor: 'rgba(239, 68, 68, 0.08)',
        color: 'var(--danger)',
        borderColor: 'rgba(239, 68, 68, 0.2)'
      });
    }
    
    const contacted = Number(perf.contacted_leads || 0);
    const qualified = Number(perf.qualified_leads || 0);
    const negotiation = Number(perf.negotiation_leads || 0);
    if (contacted + qualified + negotiation >= 3) {
      badges.push({
        text: 'Follow-up Hero',
        icon: '💬',
        bgColor: 'rgba(14, 165, 233, 0.08)',
        color: 'var(--accent)',
        borderColor: 'rgba(14, 165, 233, 0.2)'
      });
    }
    
    return badges;
  };

  useEffect(() => {
    if (user) {
      loadAgents();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      // 1. Fetch agents who report to this admin
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('admin_id', user.id)
        .eq('role', 'agent')
        .order('created_at', { ascending: false });
        
      if (agentsError) throw agentsError;
      setAgents(agentsData || []);

      if (agentsData && agentsData.length > 0) {
        const agentIds = agentsData.map(a => a.id);

        // 2. Fetch Lead Stats for these agents
        const { data: leadStats, error: lError } = await supabase
          .from('lead_stats')
          .select('*')
          .in('user_id', agentIds);

        // 3. Fetch Deal Stats for these agents
        const { data: dealStats, error: dError } = await supabase
          .from('deal_stats')
          .select('*')
          .in('user_id', agentIds);

        // Map data to agent IDs
        const perfMap = {};
        agentIds.forEach(id => {
          const l = leadStats?.find(s => s.user_id === id) || {};
          const d = dealStats?.find(s => s.user_id === id) || {};
          perfMap[id] = { ...l, ...d };
        });
        setPerformanceData(perfMap);

        // Calculate Team Aggregates
        const totals = {
          totalRevenue: dealStats?.reduce((sum, d) => sum + Number(d.total_revenue || 0), 0) || 0,
          totalLeads: leadStats?.reduce((sum, l) => sum + Number(l.total_leads || 0), 0) || 0,
          totalWon: leadStats?.reduce((sum, l) => sum + Number(l.won_leads || 0), 0) || 0,
        };
        totals.avgConversion = totals.totalLeads > 0 
          ? ((totals.totalWon / totals.totalLeads) * 100).toFixed(1) 
          : 0;
        
        setTeamStats(totals);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async () => {
    if (!form.fullName || !form.email || !form.password) {
      toast.warning('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/team/add-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          adminId: user.id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add agent');
      }

      toast.success('Agent added successfully');
      setModalOpen(false);
      setForm({ fullName: '', email: '', password: '' });
      loadAgents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Monitor performance and manage your sales team
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Agent</button>
      </div>

      {!loading && agents.length > 0 && (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px', 
            marginBottom: '24px' 
          }}>
            <StatCard icon={<IndianRupee size={24} />} label="Team Revenue" value={formatCurrency(teamStats.totalRevenue)} color="success" delay={0} />
            <StatCard icon={<Users size={24} />} label="Total Team Leads" value={teamStats.totalLeads} color="primary" delay={100} />
            <StatCard icon={<TrendingUp size={24} />} label="Avg. Conversion" value={`${teamStats.avgConversion}%`} color="warning" delay={200} />
            <StatCard icon={<Briefcase size={24} />} label="Active Agents" value={agents.length} color="accent" delay={300} />
          </div>

          {/* Premium Team Target Progress Card */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(14, 165, 233, 0.02) 100%)',
            border: '1px solid rgba(79, 70, 229, 0.15)',
            borderRadius: '12px',
            padding: '22px 24px',
            marginBottom: '28px',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s var(--transition-base)'
          }}>
            {/* Ambient lighting effect */}
            <div style={{
              position: 'absolute',
              top: '-60px',
              right: '-60px',
              width: '180px',
              height: '180px',
              background: 'radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 0
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  background: 'var(--primary)',
                  color: 'white',
                  width: 42,
                  height: 42,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 14px var(--primary-glow)'
                }}>
                  <Target size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Monthly Agency Sales Target</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cumulative Goal: ₹5.00 Crore</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  {Math.min(((teamStats.totalRevenue / agencyTarget) * 100), 100).toFixed(1)}%
                </span>
                <p style={{ margin: '1px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{formatCurrency(teamStats.totalRevenue)} Won</p>
              </div>
            </div>

            <div style={{ width: '100%', height: 10, background: 'var(--border-color)', borderRadius: 5, overflow: 'hidden', marginBottom: 12, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: `${Math.min(((teamStats.totalRevenue / agencyTarget) * 100), 100).toFixed(1)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
                borderRadius: 5,
                transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative'
              }}>
                {/* Micro-animation shimmer shine */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent)',
                  animation: 'shimmer 2.5s infinite linear',
                  backgroundSize: '200% 100%'
                }} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>
              <span>₹0 Cr</span>
              <span style={{ fontWeight: 600, color: (teamStats.totalRevenue >= agencyTarget) ? 'var(--success)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {teamStats.totalRevenue >= agencyTarget ? (
                  <>🎉 Milestone Achieved! Excellent job!</>
                ) : (
                  <>₹{Math.max((50000000 - teamStats.totalRevenue) / 10000000, 0).toFixed(2)}Cr remaining to target</>
                )}
              </span>
              <span>₹5.00 Cr</span>
            </div>
          </div>
        </>
      )}

      <div className="tab-bar">
        <button 
          onClick={() => setActiveTab('roster')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'roster' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'roster' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Team Roster
        </button>
        <button 
          onClick={() => setActiveTab('performance')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'performance' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'performance' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Performance Metrics
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 60, width: '100%' }} />
          <div className="skeleton" style={{ height: 200, width: '100%' }} />
        </div>
      ) : agents.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>👔</span>
            <h3>No agents found</h3>
            <p>Click "Add Agent" to invite your first team member.</p>
          </div>
        </div>
      ) : activeTab === 'roster' ? (
        <>
          {/* Desktop table */}
          <div className="data-table-wrapper animate-fadeIn" style={{ display: 'none' }} id="roster-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.8rem', color: 'white'
                        }}>
                          {agent.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{agent.full_name}</span>
                      </div>
                    </td>
                    <td>{agent.email}</td>
                    <td><span className="badge badge-medium" style={{textTransform:'capitalize'}}>{agent.role}</span></td>
                    <td>{new Date(agent.created_at).toLocaleDateString()}</td>
                    <td><span className="badge badge-success">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Responsive: desktop table + mobile cards */}
          <style>{`
            @media (min-width: 769px) { #roster-table { display: block !important; } #roster-cards { display: none !important; } }
            @media (max-width: 768px) { #roster-table { display: none !important; } #roster-cards { display: flex !important; } }
          `}</style>

          {/* Mobile cards */}
          <div id="roster-cards" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
            {agents.map((agent, i) => (
              <div key={agent.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                animation: `fadeInUp 0.3s ease ${i * 40}ms backwards`,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1rem', color: 'white', flexShrink: 0
                }}>
                  {agent.full_name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{agent.full_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.email}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Joined {new Date(agent.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span className="badge badge-success">Active</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{agent.role}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Gamified Leaderboard & Roster Toolbar */}
          <div style={{ 
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Search size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Search agents..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.88rem' }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort By:</span>
              <button 
                onClick={() => setSortBy('revenue')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: sortBy === 'revenue' ? 'var(--primary-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${sortBy === 'revenue' ? 'var(--primary)' : 'var(--border-color)'}`,
                  color: sortBy === 'revenue' ? 'var(--primary)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <IndianRupee size={13} /> Revenue
              </button>
              <button 
                onClick={() => setSortBy('conversion')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: sortBy === 'conversion' ? 'var(--warning-bg)' : 'var(--bg-elevated)',
                  border: `1px solid ${sortBy === 'conversion' ? 'var(--warning)' : 'var(--border-color)'}`,
                  color: sortBy === 'conversion' ? 'var(--warning)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <TrendingUp size={13} /> Conversion
              </button>
              <button 
                onClick={() => setSortBy('leads')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: sortBy === 'leads' ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${sortBy === 'leads' ? 'var(--accent)' : 'var(--border-color)'}`,
                  color: sortBy === 'leads' ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Users size={13} /> Leads
              </button>
            </div>
          </div>

          {/* Desktop performance table */}
          <div className="data-table-wrapper animate-fadeIn" id="perf-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Agent Name</th>
                  <th>Achievements</th>
                  <th>Leads</th>
                  <th>Converted</th>
                  <th>Conv. Rate</th>
                  <th>Revenue</th>
                  <th>Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {agents
                  .filter(agent => agent.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .sort((a, b) => {
                    const perfA = performanceData[a.id] || {};
                    const perfB = performanceData[b.id] || {};
                    
                    if (sortBy === 'revenue') {
                      return Number(perfB.total_revenue || 0) - Number(perfA.total_revenue || 0);
                    } else if (sortBy === 'conversion') {
                      return Number(perfB.conversion_rate || 0) - Number(perfA.conversion_rate || 0);
                    } else {
                      return Number(perfB.total_leads || 0) - Number(perfA.total_leads || 0);
                    }
                  })
                  .map((agent, i) => {
                    const perf = performanceData[agent.id] || {};
                    const rank = revenueRanks[agent.id] || (i + 1);
                    const badges = getAchievementBadges(perf, rank);
                    
                    return (
                      <tr key={agent.id}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {renderRankBadge(rank)}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: rank === 1 ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'var(--primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.78rem', color: 'white',
                              boxShadow: rank === 1 ? '0 4px 10px var(--primary-glow)' : 'none'
                            }}>
                              {agent.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{agent.full_name}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {badges.map((badge, idx) => (
                              <span 
                                key={idx} 
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  background: badge.bgColor,
                                  color: badge.color,
                                  border: `1px solid ${badge.borderColor}`
                                }}
                              >
                                <span>{badge.icon}</span>
                                <span>{badge.text}</span>
                              </span>
                            ))}
                            {badges.length === 0 && (
                              <span style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                background: 'rgba(79, 70, 229, 0.04)',
                                color: 'var(--text-muted)',
                                border: '1px dashed var(--border-color)'
                              }}>
                                <span>✨</span>
                                <span>Rising Star</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }}>{perf.total_leads || 0} Total</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{perf.new_leads || 0} New</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{perf.won_leads || 0}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${perf.conversion_rate || 0}%`, height: '100%', background: 'var(--warning)', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{perf.conversion_rate || 0}%</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(perf.total_revenue || 0)}</td>
                        <td>{formatCurrency(perf.pipeline_value || 0)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <style>{`
            @media (max-width: 768px) { #perf-table { display: none !important; } #perf-cards { display: flex !important; } }
          `}</style>

          {/* Mobile performance cards */}
          <div id="perf-cards" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
            {agents
              .filter(agent => agent.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
              .sort((a, b) => {
                const perfA = performanceData[a.id] || {};
                const perfB = performanceData[b.id] || {};
                
                if (sortBy === 'revenue') {
                  return Number(perfB.total_revenue || 0) - Number(perfA.total_revenue || 0);
                } else if (sortBy === 'conversion') {
                  return Number(perfB.conversion_rate || 0) - Number(perfA.conversion_rate || 0);
                } else {
                  return Number(perfB.total_leads || 0) - Number(perfA.total_leads || 0);
                }
              })
              .map((agent, i) => {
                const perf = performanceData[agent.id] || {};
                const rank = revenueRanks[agent.id] || (i + 1);
                const badges = getAchievementBadges(perf, rank);
                
                return (
                  <div key={agent.id} style={{
                    background: 'var(--bg-card)',
                    border: rank === 1 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '18px',
                    boxShadow: rank === 1 ? '0 8px 24px rgba(79, 70, 229, 0.12)' : 'var(--shadow-sm)',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: `fadeInUp 0.3s ease ${i * 40}ms backwards`
                  }}>
                    {/* Floating Rank badge in mobile card */}
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      {renderRankBadge(rank)}
                    </div>
                    
                    {/* Agent Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: rank === 1 ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.9rem', color: 'white', flexShrink: 0
                      }}>
                        {agent.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {agent.full_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{agent.email}</div>
                      </div>
                    </div>

                    {/* Achievements under info */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {badges.map((badge, idx) => (
                        <span 
                          key={idx} 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            background: badge.bgColor,
                            color: badge.color,
                            border: `1px solid ${badge.borderColor}`
                          }}
                        >
                          <span>{badge.icon}</span>
                          <span>{badge.text}</span>
                        </span>
                      ))}
                      {badges.length === 0 && (
                        <span style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          background: 'rgba(79, 70, 229, 0.04)',
                          color: 'var(--text-muted)',
                          border: '1px dashed var(--border-color)'
                        }}>
                          <span>✨</span>
                          <span>Rising Star</span>
                        </span>
                      )}
                    </div>
                    
                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Leads</div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{perf.total_leads || 0}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{perf.new_leads || 0} new</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Converted</div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{perf.won_leads || 0}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{perf.conversion_rate || 0}% rate</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Revenue</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>{formatCurrency(perf.total_revenue || 0)}</div>
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Pipeline</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>{formatCurrency(perf.pipeline_value || 0)}</div>
                      </div>
                    </div>

                    {/* Conversion bar */}
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Conversion Rate</span>
                        <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{perf.conversion_rate || 0}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${perf.conversion_rate || 0}%`, height: '100%', background: 'var(--warning)', transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* Add Agent Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Agent"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddAgent} disabled={saving}>
              {saving ? 'Adding...' : 'Create Agent'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              className="form-input" 
              value={form.fullName} 
              onChange={e => setForm({ ...form, fullName: e.target.value })} 
              placeholder="e.g. John Doe" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address (Login ID)</label>
            <input 
              className="form-input" 
              type="email"
              value={form.email} 
              onChange={e => setForm({ ...form, email: e.target.value })} 
              placeholder="john@example.com" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password</label>
            <input 
              className="form-input" 
              type="password"
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
              placeholder="Set a strong password" 
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

