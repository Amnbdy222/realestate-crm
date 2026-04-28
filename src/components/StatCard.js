'use client';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatCard({ icon, label, value, trend, trendUp, color = 'primary', delay = 0 }) {
  const colorMap = {
    primary: { bg: 'rgba(108, 92, 231, 0.1)', border: 'rgba(108, 92, 231, 0.25)', icon: '#A29BFE' },
    accent: { bg: 'rgba(0, 210, 255, 0.1)', border: 'rgba(0, 210, 255, 0.25)', icon: '#74E4FF' },
    success: { bg: 'rgba(0, 184, 148, 0.1)', border: 'rgba(0, 184, 148, 0.25)', icon: '#55EFC4' },
    warning: { bg: 'rgba(253, 203, 110, 0.1)', border: 'rgba(253, 203, 110, 0.25)', icon: '#FFEAA7' },
    danger: { bg: 'rgba(255, 107, 107, 0.1)', border: 'rgba(255, 107, 107, 0.25)', icon: '#FF8E8E' },
  };

  const c = colorMap[color] || colorMap.primary;

  return (
    <div
      className="card animate-fadeInUp"
      style={{
        background: c.bg,
        borderColor: c.border,
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
            {label}
          </p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {value}
          </h2>
          {trend && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: trendUp ? 'var(--success)' : 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6
            }}>
              {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {trend}
            </span>
          )}
        </div>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-md)',
          background: c.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          color: c.icon
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
