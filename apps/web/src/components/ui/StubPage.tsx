interface StubPageProps {
  title: string;
  icon: string;
  description?: string;
}

export function StubPage({ title, icon, description }: StubPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-6 fade-up">
      {/* Icon container */}
      <div className="relative">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-[22px] opacity-30 blur-xl"
          style={{ background: 'radial-gradient(circle, rgba(170,48,0,0.4) 0%, transparent 70%)' }}
        />
        {/* Icon box */}
        <div
          className="relative w-20 h-20 rounded-[20px] flex items-center justify-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(170,48,0,0.10) 0%, rgba(170,48,0,0.05) 100%)',
            border: '1px solid rgba(170,48,0,0.15)',
            boxShadow: '0 8px 24px rgba(170,48,0,0.10), 0 2px 8px rgba(19,27,46,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '32px',
              color: '#aa3000',
              fontVariationSettings: "'FILL' 0, 'wght' 300",
            }}
          >
            {icon}
          </span>
        </div>
      </div>

      {/* Text content */}
      <div className="text-center max-w-sm">
        <h2
          className="text-2xl font-bold text-on-surface mb-2 tracking-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          {title}
        </h2>
        {description && (
          <p className="text-[14px] text-on-surface-variant leading-relaxed">{description}</p>
        )}

        {/* Status badge */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold"
            style={{
              background: 'rgba(5,150,105,0.08)',
              border: '1px solid rgba(5,150,105,0.2)',
              color: '#059669',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse-dot"
              style={{ flexShrink: 0 }}
            />
            Backend API ready
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
            style={{
              background: 'rgba(121,86,0,0.07)',
              border: '1px solid rgba(121,86,0,0.15)',
              color: '#795600',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}
            >
              build
            </span>
            UI in progress
          </span>
        </div>
      </div>
    </div>
  );
}
