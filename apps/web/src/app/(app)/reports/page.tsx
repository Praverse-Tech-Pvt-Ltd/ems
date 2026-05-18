'use client';

export default function ReportsPage() {
  const ATTENDANCE = [92,95,96,94,97,98,93,96,97,95,96,98,99,96];
  const PIE = [
    { l: 'TRAVEL',      v: 38, c: 'bg-brutal-yellow', hex: '#ffa23a' },
    { l: 'REAGENTS',    v: 26, c: 'bg-brutal-blue',   hex: '#0055ff' },
    { l: 'SOFTWARE',    v: 18, c: 'bg-brutal-ink',     hex: '#1a1a1a' },
    { l: 'HOSPITALITY', v: 12, c: 'bg-brutal-red',    hex: '#e63b2e' },
    { l: 'MISC',        v: 6,  c: 'bg-brutal-surface', hex: '#eee9e0' },
  ];

  // Build pie paths
  let cumulative = 0;
  const paths = PIE.map(seg => {
    const start = cumulative;
    const end   = start + (seg.v / 100) * 360;
    const r = 48, cx = 50, cy = 50;
    const sx = cx + r * Math.cos(Math.PI * (start - 90) / 180);
    const sy = cy + r * Math.sin(Math.PI * (start - 90) / 180);
    const ex = cx + r * Math.cos(Math.PI * (end - 90) / 180);
    const ey = cy + r * Math.sin(Math.PI * (end - 90) / 180);
    const large = (end - start) > 180 ? 1 : 0;
    cumulative = end;
    return { ...seg, d: `M${cx},${cy} L${sx},${sy} A${r},${r} 0 ${large} 1 ${ex},${ey} Z` };
  });

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      <div>
        <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— REPORTS / 09</div>
        <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
          ORG <span className="inline-block bg-brutal-yellow px-2">DASHBOARDS</span><span className="text-brutal-red">.</span>
        </h1>
        <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">REFRESHED EVERY 15 MIN · LAST 12:00 IST</div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 brutal-border brutal-shadow">
        {[
          { l: 'HEADCOUNT',      v: '184',    s: '+6 QTD',       bg: 'bg-brutal-cream' },
          { l: 'ATTENDANCE',     v: '96.4%',  s: 'MTD',          bg: 'bg-brutal-yellow' },
          { l: 'OPEN APPROVALS', v: '12',     s: '3 OVERDUE',    bg: 'bg-brutal-red text-white' },
          { l: 'PAYROLL · APR',  v: '₹ 2.4Cr',s: 'CLEARED',     bg: 'bg-[#0F8F3A] text-white' },
        ].map((s, i) => (
          <div key={s.l} className={`p-5 ${i < 3 ? 'brutal-border-b md:border-b-0 md:brutal-border-r' : ''} ${s.bg}`}>
            <div className="font-display font-bold text-[10px] tracking-[0.22em]">{s.l}</div>
            <div className="mt-2 text-[28px] sm:text-[36px] lg:text-[40px] leading-[0.9] font-bold num">{s.v}</div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em]">{s.s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance bar chart */}
        <div className="brutal-border brutal-shadow">
          <div className="px-4 py-2 brutal-border-b bg-brutal-ink text-brutal-cream flex items-center justify-between">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">ATTENDANCE · 14 DAYS</span>
            <span className="font-display font-bold text-[10px] tracking-[0.18em]">% PRESENT</span>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-44">
              {ATTENDANCE.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-brutal-ink border-[2px] border-brutal-ink" style={{ height: `${(v - 85) * 7}%`, minHeight: '6px' }} />
                  <div className="font-display font-bold text-[8px] tracking-[0.1em] text-brutal-ink/50">{i + 1}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="border-[3px] border-brutal-ink p-2">
                <div className="font-display font-bold text-[9px] tracking-[0.2em] text-brutal-ink/60">AVG</div>
                <div className="text-[18px] font-bold num">95.8%</div>
              </div>
              <div className="border-[3px] border-brutal-ink p-2 bg-brutal-yellow">
                <div className="font-display font-bold text-[9px] tracking-[0.2em]">PEAK</div>
                <div className="text-[18px] font-bold num">99.0%</div>
              </div>
              <div className="border-[3px] border-brutal-ink p-2 bg-brutal-red text-white">
                <div className="font-display font-bold text-[9px] tracking-[0.2em]">LOW</div>
                <div className="text-[18px] font-bold num">92.0%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Expense pie */}
        <div className="brutal-border brutal-shadow">
          <div className="px-4 py-2 brutal-border-b bg-brutal-blue text-white flex items-center justify-between">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">EXPENSE MIX · MTD</span>
            <span className="font-display font-bold text-[10px] tracking-[0.18em]">₹ 12.4 LAKH</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-5 items-center justify-items-center sm:justify-items-start">
            <svg viewBox="0 0 100 100" className="w-[140px] h-[140px]">
              {paths.map((p, i) => (
                <path key={i} d={p.d} fill={p.hex} stroke="#1a1a1a" strokeWidth="1.5" />
              ))}
              <circle cx="50" cy="50" r="48" fill="none" stroke="#1a1a1a" strokeWidth="2" />
            </svg>
            <ul className="space-y-2">
              {PIE.map(x => (
                <li key={x.l} className="flex items-center gap-2 font-display font-bold text-[11px] tracking-[0.14em]">
                  <span className={`w-3 h-3 border-2 border-brutal-ink ${x.c}`} />
                  <span className="flex-1">{x.l}</span>
                  <span className="num text-brutal-ink/70">{x.v}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
