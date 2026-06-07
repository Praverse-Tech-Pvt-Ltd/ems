'use client';

const depts = [
  { name: 'Engineering', headcount: 14, capacity: 85, skills: ['React', 'Node', 'DevOps'], gap: 'Cloud expertise', color: 'bg-primary/10 border-primary/30 text-primary' },
  { name: 'Finance', headcount: 6, capacity: 100, skills: ['Tally', 'GST', 'Payroll'], gap: null, color: 'bg-tertiary/10 border-tertiary/30 text-tertiary' },
  { name: 'HR', headcount: 4, capacity: 75, skills: ['Compliance', 'Hiring'], gap: 'L&D specialist', color: 'bg-error/10 border-error/30 text-error' },
  { name: 'Sales', headcount: 9, capacity: 90, skills: ['CRM', 'Pharma', 'Outreach'], gap: null, color: 'bg-primary/10 border-primary/30 text-primary' },
  { name: 'Delivery', headcount: 8, capacity: 70, skills: ['PM', 'QA', 'Logistics'], gap: 'QA lead needed', color: 'bg-error/10 border-error/30 text-error' },
  { name: 'Design', headcount: 3, capacity: 95, skills: ['Figma', 'UX Research'], gap: null, color: 'bg-tertiary/10 border-tertiary/30 text-tertiary' },
];

const signals = [
  { name: 'Deven Nair', dept: 'Delivery', signal: 'Overloaded — 3 concurrent projects', tone: 'text-error', icon: 'warning', initials: 'DN' },
  { name: 'Kavya Iyer', dept: 'Engineering', signal: 'Onboarding incomplete — docs pending', tone: 'text-primary', icon: 'person_add', initials: 'KI' },
  { name: 'Sneha Kulkarni', dept: 'Sales', signal: 'Top performer — Q3 target exceeded', tone: 'text-tertiary', icon: 'star', initials: 'SK' },
  { name: 'Rahul Verma', dept: 'HR', signal: 'On leave — backfill coverage needed', tone: 'text-primary', icon: 'event_busy', initials: 'RV' },
];

export default function AiTalentMappingPage() {
  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">psychology</span>
          TALENT
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">AI Talent Mapping</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">AI Talent Mapping</h2>
            <p className="text-on-surface-variant mt-xs">AI-mapped departments, skill gaps, capacity signals, and onboarding health.</p>
          </div>
          <button className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90 transition-opacity shrink-0">
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            Run AI Analysis
          </button>
        </div>
      </div>

      {/* Department capacity matrix */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">DEPARTMENT CAPACITY MAP</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-sm">
          {depts.map(d => (
            <div key={d.name} className={`glass-card rounded-2xl p-md border flex flex-col gap-sm ${d.color}`}>
              <div className="flex items-start justify-between">
                <p className="font-semibold text-on-surface text-sm">{d.name}</p>
                {d.gap && (
                  <span className="material-symbols-outlined text-[14px] text-error">warning</span>
                )}
              </div>
              <div>
                <p className="font-display-md text-on-surface font-black text-2xl">{d.headcount}</p>
                <p className="text-[10px] text-on-surface-variant">headcount</p>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
                  <span>Capacity</span>
                  <span className="font-bold">{d.capacity}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                  <div
                    className={`h-full rounded-full ${d.capacity >= 90 ? 'bg-tertiary' : d.capacity >= 75 ? 'bg-primary' : 'bg-error'}`}
                    style={{ width: `${d.capacity}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {d.skills.map(s => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30">{s}</span>
                ))}
              </div>
              {d.gap && (
                <p className="text-[10px] text-error font-semibold">Gap: {d.gap}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Performance Signals + AI Ask panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-lg">
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">AI TALENT SIGNALS</p>
          <div className="flex flex-col gap-sm">
            {signals.map(s => (
              <div key={s.name} className="glass-card rounded-xl p-sm border border-outline-variant/30 flex items-start gap-md hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-sm text-on-surface shrink-0">
                  {s.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-sm">
                    <p className="font-semibold text-on-surface text-sm">{s.name}</p>
                    <span className="text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">{s.dept}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{s.signal}</p>
                </div>
                <span className={`material-symbols-outlined text-[20px] shrink-0 ${s.tone}`}>{s.icon}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Query panel */}
        <div className="glass-card rounded-2xl p-lg flex flex-col gap-md border-l-4 border-l-primary ai-shimmer">
          <div className="flex items-center gap-sm text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            <h3 className="font-title-md text-title-md">Ask AI</h3>
          </div>
          <p className="text-body-sm text-on-surface-variant">Ask who is overloaded, which skill gaps are critical, or where onboarding is blocked.</p>
          <div className="flex flex-col gap-sm mt-auto">
            {['Who can cover QA lead?', 'Which dept is near capacity?', 'Onboarding blockers this week'].map(q => (
              <button key={q} className="text-left text-body-sm text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg px-sm py-2 transition-colors">
                {q}
              </button>
            ))}
          </div>
          <div className="relative border-t border-outline-variant/30 pt-sm">
            <input className="w-full border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-body-sm px-0 py-2 bg-transparent placeholder:text-on-surface-variant/50" placeholder="Ask about talent..." />
            <button className="absolute right-0 bottom-2 text-primary" aria-label="Send">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
