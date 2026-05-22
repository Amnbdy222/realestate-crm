'use client';
import React, { useState, useEffect, useRef } from 'react';
import styles from './LandingPage.module.css';
import {
  Users, Building2, TrendingUp, Mic, Lock, ArrowRight,
  ShieldCheck, Sparkles, Star, CheckCircle, Zap, BarChart3,
  Bell, Globe, ChevronDown, Play, X, Menu, Trophy,
  CalendarCheck, FileText, Phone, Target, Award
} from 'lucide-react';

/* ── Animated counter ── */
function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

/* ── Intersection observer ── */
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ── Data ── */
const FEATURES = [
  {
    icon: <Users size={20} />,
    title: 'Lead Management',
    desc: 'Capture, score, and assign leads with AI. Bulk actions, deduplication, CSV export, and full audit trail built in.',
    tag: 'Core CRM',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Pipeline Board',
    desc: 'Drag-and-drop Kanban with real-time sync across your team. Collapse stages, auto-scroll, and instant status updates.',
    tag: 'Sales',
  },
  {
    icon: <Sparkles size={20} />,
    title: 'AI Assistant',
    desc: 'Daily insights, lead scoring, WhatsApp follow-up drafts, and voice transcription — all powered by Groq Llama 3.1.',
    tag: 'AI',
  },
  {
    icon: <Building2 size={20} />,
    title: 'Builder Inventory',
    desc: 'Manage projects, towers, and units. Track availability, floor-rise pricing, and bookings with a full developer module.',
    tag: 'Inventory',
  },
  {
    icon: <CalendarCheck size={20} />,
    title: 'Follow-up Scheduler',
    desc: 'Schedule calls, meetings, and site visits. Get notified before they are due. Never miss a follow-up again.',
    tag: 'Productivity',
  },
  {
    icon: <Lock size={20} />,
    title: 'Enterprise Security',
    desc: 'Row-Level Security on every table. Agents see only their data. Admins get full visibility. Zero data leakage.',
    tag: 'Security',
  },
];

const STATS = [
  { value: 2500, suffix: '+', label: 'Leads Managed' },
  { value: 98,   suffix: '%', label: 'Uptime SLA' },
  { value: 150,  suffix: '+', label: 'Active Teams' },
  { value: 40,   suffix: '%', label: 'Faster Closings' },
];

const TESTIMONIALS = [
  {
    name: 'Rahul Sharma',
    role: 'Sales Head, PropNest Realty',
    initial: 'R',
    text: 'DealBook transformed how our 12-agent team operates. The pipeline board and AI scoring alone saved us 3 hours daily.',
  },
  {
    name: 'Priya Mehta',
    role: 'Founder, Skyline Properties',
    initial: 'P',
    text: 'The voice transcription feature is a game-changer. I record site visits and leads are auto-created. Incredible.',
  },
  {
    name: 'Arjun Kapoor',
    role: 'Director, Urban Nest Developers',
    initial: 'A',
    text: 'Builder inventory management is exactly what we needed. Booking tracking and channel partner logs are flawless.',
  },
];

const LOGOS = ['PropNest', 'Skyline', 'Urban Nest', 'Horizon Realty', 'Prime Estates', 'NestWorth'];

export default function LandingPage({ onLoginClick, onRegisterClick }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [statsRef, statsInView] = useInView(0.3);

  const c0 = useCounter(STATS[0].value, 2000, statsInView);
  const c1 = useCounter(STATS[1].value, 2000, statsInView);
  const c2 = useCounter(STATS[2].value, 2000, statsInView);
  const c3 = useCounter(STATS[3].value, 2000, statsInView);
  const counters = [c0, c1, c2, c3];

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveFeature(p => (p + 1) % FEATURES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.page}>

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header className={`${styles.header} ${scrolled ? styles.headerShadow : ''}`}>
        <div className={styles.headerInner}>
          {/* Logo */}
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <img src="/logo.png" alt="DealBook" className={styles.logoImg} />
            </div>
            <span className={styles.logoName}>DealBook</span>
          </div>

          {/* Nav */}
          <nav className={styles.nav}>
            <a href="#features"     className={styles.navLink}>Features</a>
            <a href="#stats"        className={styles.navLink}>Why Us</a>
            <a href="#testimonials" className={styles.navLink}>Customers</a>
            <a href="#about"        className={styles.navLink}>About</a>
          </nav>

          {/* CTA */}
          <div className={styles.headerCta}>
            <button className={styles.btnGhost} onClick={onLoginClick}>Sign In</button>
            <button className={styles.btnPrimary} onClick={onRegisterClick}>
              Start Free Trial
            </button>
          </div>

          {/* Hamburger */}
          <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className={styles.mobileNav}>
          <a href="#features"     onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#stats"        onClick={() => setMobileOpen(false)}>Why Us</a>
          <a href="#testimonials" onClick={() => setMobileOpen(false)}>Customers</a>
          <a href="#about"        onClick={() => setMobileOpen(false)}>About</a>
          <div className={styles.mobileNavCta}>
            <button className={styles.btnGhostFull} onClick={() => { setMobileOpen(false); onLoginClick(); }}>Sign In</button>
            <button className={styles.btnPrimaryFull} onClick={() => { setMobileOpen(false); onRegisterClick(); }}>Start Free Trial</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          {/* Left: copy */}
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              <span className={styles.badgeDot} />
              Crafted by makemysoftware
            </div>

            <h1 className={styles.heroH1}>
              The Real Estate CRM<br />
              Built for <span className={styles.heroAccent}>Serious Teams</span>
            </h1>

            <p className={styles.heroP}>
              Manage leads, close deals, coordinate properties, and drive agent performance.
              DealBook is a multi-tenant CRM engineered for modern real estate brokerages.
            </p>

            <div className={styles.heroCta}>
              <button className={styles.btnPrimary} onClick={onRegisterClick}>
                Start Your Free Trial <ArrowRight size={16} />
              </button>
              <button className={styles.btnOutline} onClick={onLoginClick}>
                <span className={styles.playCircle}><Play size={12} fill="currentColor" /></span>
                Sign In
              </button>
            </div>

            <ul className={styles.heroChecks}>
              <li><CheckCircle size={14} /> No credit card required</li>
              <li><CheckCircle size={14} /> Free forever plan</li>
              <li><CheckCircle size={14} /> Setup in 2 minutes</li>
            </ul>
          </div>

          {/* Right: browser mockup */}
          <div className={styles.heroRight}>
            <div className={styles.browser}>
              <div className={styles.browserChrome}>
                <span className={styles.chromeDot} style={{ background: '#FF5F57' }} />
                <span className={styles.chromeDot} style={{ background: '#FEBC2E' }} />
                <span className={styles.chromeDot} style={{ background: '#28C840' }} />
                <div className={styles.chromeUrl}>app.dealbook.in/dashboard</div>
              </div>
              <img
                src="/dashboard-preview.png"
                alt="DealBook Dashboard"
                className={styles.browserImg}
              />
            </div>

            {/* Floating stat chips */}
            <div className={`${styles.chip} ${styles.chip1}`}>
              <TrendingUp size={14} className={styles.chipIcon} />
              <div>
                <div className={styles.chipVal}>+24%</div>
                <div className={styles.chipLbl}>Conversion rate</div>
              </div>
            </div>
            <div className={`${styles.chip} ${styles.chip2}`}>
              <Bell size={14} className={styles.chipIcon} />
              <div>
                <div className={styles.chipVal}>3 due today</div>
                <div className={styles.chipLbl}>Follow-ups</div>
              </div>
            </div>
            <div className={`${styles.chip} ${styles.chip3}`}>
              <Sparkles size={14} className={styles.chipIcon} />
              <div>
                <div className={styles.chipVal}>Score: 87</div>
                <div className={styles.chipLbl}>Hot lead</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.scrollCue}>
          <ChevronDown size={18} />
        </div>
      </section>

      {/* ══════════════════════════════════════
          LOGO BAR
      ══════════════════════════════════════ */}
      <div className={styles.logoBar}>
        <p className={styles.logoBarLabel}>Trusted by real estate teams across India</p>
        <div className={styles.logoBarRow}>
          {LOGOS.map((l, i) => (
            <span key={i} className={styles.logoBarItem}>{l}</span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <section id="stats" className={styles.statsSection} ref={statsRef}>
        <div className={styles.statsGrid}>
          {STATS.map((s, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.statNum}>{counters[i]}{s.suffix}</div>
              <div className={styles.statLbl}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES — INTERACTIVE PANEL
      ══════════════════════════════════════ */}
      <section id="features" className={styles.featSection}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Features</span>
          <h2 className={styles.sectionH2}>Everything your agency needs</h2>
          <p className={styles.sectionP}>
            A complete suite of enterprise-grade tools — leads, pipeline, AI, inventory, and more.
          </p>
        </div>

        <div className={styles.featLayout}>
          {/* Tab list */}
          <div className={styles.featTabs}>
            {FEATURES.map((f, i) => (
              <button
                key={i}
                className={`${styles.featTab} ${activeFeature === i ? styles.featTabOn : ''}`}
                onClick={() => setActiveFeature(i)}
              >
                <span className={`${styles.featTabIcon} ${activeFeature === i ? styles.featTabIconOn : ''}`}>
                  {f.icon}
                </span>
                <span className={styles.featTabLabel}>{f.title}</span>
                {activeFeature === i && <span className={styles.featTabArrow}><ArrowRight size={14} /></span>}
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className={styles.featPanel} key={activeFeature}>
            <span className={styles.featPanelTag}>{FEATURES[activeFeature].tag}</span>
            <div className={styles.featPanelIconWrap}>
              {FEATURES[activeFeature].icon}
            </div>
            <h3 className={styles.featPanelTitle}>{FEATURES[activeFeature].title}</h3>
            <p className={styles.featPanelDesc}>{FEATURES[activeFeature].desc}</p>
            <div className={styles.featDots}>
              {FEATURES.map((_, i) => (
                <button
                  key={i}
                  className={`${styles.dot} ${activeFeature === i ? styles.dotOn : ''}`}
                  onClick={() => setActiveFeature(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURE CARDS GRID
      ══════════════════════════════════════ */}
      <section className={styles.cardsSection}>
        <div className={styles.cardsGrid}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={`${styles.card} ${activeFeature === i ? styles.cardActive : ''}`}
              onMouseEnter={() => setActiveFeature(i)}
            >
              <div className={styles.cardIconWrap}>{f.icon}</div>
              <div className={styles.cardTag}>{f.tag}</div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section className={styles.howSection}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>How it works</span>
          <h2 className={styles.sectionH2}>Up and running in minutes</h2>
        </div>
        <div className={styles.steps}>
          {[
            { n: '01', title: 'Create your account', desc: 'Sign up as an admin and set up your organisation in under 2 minutes.' },
            { n: '02', title: 'Add your team',        desc: 'Invite agents, assign roles, and configure lead routing rules.' },
            { n: '03', title: 'Import your leads',    desc: 'Upload a CSV or connect via our external API. Leads appear instantly.' },
            { n: '04', title: 'Close more deals',     desc: 'Use the pipeline board, AI insights, and follow-up scheduler to convert.' },
          ].map((s, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNum}>{s.n}</div>
              <h4 className={styles.stepTitle}>{s.title}</h4>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section id="testimonials" className={styles.testiSection}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Testimonials</span>
          <h2 className={styles.sectionH2}>Trusted by real estate professionals</h2>
        </div>
        <div className={styles.testiGrid}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={styles.testiCard}>
              <div className={styles.testiStars}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={13} fill="#F59E0B" color="#F59E0B" />
                ))}
              </div>
              <p className={styles.testiQuote}>"{t.text}"</p>
              <div className={styles.testiAuthor}>
                <div className={styles.testiAvatar}>{t.initial}</div>
                <div>
                  <div className={styles.testiName}>{t.name}</div>
                  <div className={styles.testiRole}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA BAND
      ══════════════════════════════════════ */}
      <section className={styles.ctaBand}>
        <div className={styles.ctaBandInner}>
          <div>
            <h2 className={styles.ctaBandH2}>Ready to close more deals?</h2>
            <p className={styles.ctaBandP}>Join 150+ real estate teams already using DealBook.</p>
          </div>
          <div className={styles.ctaBandActions}>
            <button className={styles.btnWhite} onClick={onRegisterClick}>
              Get Started Free <ArrowRight size={16} />
            </button>
            <button className={styles.btnWhiteOutline} onClick={onLoginClick}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          ABOUT
      ══════════════════════════════════════ */}
      <section id="about" className={styles.aboutSection}>
        <div className={styles.aboutCard}>
          <div className={styles.aboutIcon}><Globe size={24} /></div>
          <h2 className={styles.aboutH2}>Built for high-growth teams</h2>
          <p className={styles.aboutP}>
            DealBook is designed and developed by{' '}
            <strong className={styles.aboutBrand}>makemysoftware</strong>, a premium software
            consultancy specialising in enterprise automation, bespoke business workflows, and
            modern cloud architecture.
          </p>
          <div className={styles.aboutBadges}>
            <span className={styles.aboutBadge}><ShieldCheck size={13} /> 100% Secure RLS</span>
            <span className={styles.aboutBadge}><Star size={13} /> Premium UI/UX</span>
            <span className={styles.aboutBadge}><Zap size={13} /> AI-Powered</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <img src="/logo.png" alt="DealBook" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            <span>DealBook</span>
          </div>
          <p className={styles.footerCopy}>
            © 2026 DealBook CRM. All rights reserved. Crafted by <strong>makemysoftware</strong>.
          </p>
          <div className={styles.footerLinks}>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <button onClick={onLoginClick}>Sign In</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
