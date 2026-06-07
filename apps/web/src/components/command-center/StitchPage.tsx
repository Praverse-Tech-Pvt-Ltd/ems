'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PunchModal } from '@/components/PunchModal';

/* Maps generic dashboard action labels to the dedicated page that implements them. */
const ACTION_ROUTES: Record<string, string> = {
  'Apply Leave': '/leave-center',
  'Apply': '/leave-center',
  'Approve': '/leave-center',
  'View Balance': '/leave-center',
  'View Payslip': '/salary-payslips',
  'Download PDF': '/salary-payslips',
  'Generate': '/salary-payslips',
  'Regularize': '/attendance-punch-station',
  'Add Employee': '/employee-directory',
  'Review Docs': '/employee-directory',
  'Departments': '/employee-directory',
  'Create Claim': '/expense-tracker',
  'Approve L1': '/expense-tracker',
  'Mark Paid': '/expense-tracker',
  'Add Client': '/client-companies-overview',
  'Run Alerts': '/client-companies-overview',
  'View Invoices': '/client-companies-overview',
  'AI Summary': '/client-detail-gap-analysis',
  'Add Visit': '/client-detail-gap-analysis',
  'Open Timeline': '/client-detail-gap-analysis',
  'Add Event': '/calendar-meeting-notes',
  'Add Note': '/calendar-meeting-notes',
  'Seed Regulatory': '/calendar-meeting-notes',
  'New Direct': '/messaging-chat-hub',
  'New Group': '/messaging-chat-hub',
  'Mark Read': '/messaging-chat-hub',
  'Export PDF': '/management-review-hub',
  'Export Excel': '/management-review-hub',
  'Refresh AI': '/management-review-hub',
  'Open Logs': '/audit-compliance-log',
  'Seed Checklist': '/audit-compliance-log',
  'Open Work Map': '/ai-talent-mapping',
  'Review Updates': '/ai-talent-mapping',
  'Open Review': '/management-review-hub',
  'Export Snapshot': '/management-review-hub',
  'Run AI Summary': '/ai-work-intelligence',
};

type Metric = {
  label: string;
  value: string;
  meta: string;
  tone?: 'primary' | 'tertiary' | 'error' | 'muted';
  icon: string;
};

type ListItem = {
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
  initials?: string;
};

export type StitchPageConfig = {
  layout?: 'command' | 'workday' | 'directory' | 'finance' | 'timeline' | 'chat' | 'board';
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  aiPrompt: string;
  aiSummary: string;
  endpoints: string[];
  metrics: Metric[];
  primaryItems: ListItem[];
  secondaryItems: ListItem[];
  actions?: string[];
};

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['data', 'items', 'records', 'results', 'leaves', 'expenses', 'employees', 'companies', 'messages', 'events']) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

function toTitle(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;
  const item = value as Record<string, unknown>;
  const firstName = item['firstName'] ?? getByPath(item, 'employee.firstName') ?? getByPath(item, 'user.firstName');
  const lastName = item['lastName'] ?? getByPath(item, 'employee.lastName') ?? getByPath(item, 'user.lastName');
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return String((item['title'] ?? item['name'] ?? item['companyName'] ?? item['subject'] ?? item['type'] ?? name) || fallback);
}

function toSubtitle(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;
  const item = value as Record<string, unknown>;
  return String(
    item['description'] ??
      item['email'] ??
      item['department'] ??
      item['status'] ??
      item['amount'] ??
      item['role'] ??
      item['message'] ??
      fallback,
  );
}

function flattenData(data: unknown[]) {
  return data.flatMap(asArray).slice(0, 8);
}

function DataBadge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: Metric['tone'] }) {
  const classes = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    tertiary: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    error: 'bg-error-container text-on-error-container border-error/20',
    muted: 'bg-surface-container-low text-on-surface-variant border-outline-variant/50',
  };

  return <span className={`font-label-caps text-[10px] px-2 py-1 rounded-full border ${classes[tone]}`}>{children}</span>;
}

export function StitchPage({ config }: { config: StitchPageConfig }) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [punchType, setPunchType] = useState<'in' | 'out' | null>(null);
  const [actionNote, setActionNote] = useState('');

  const runAction = (label: string) => {
    if (label === 'Punch In') { setPunchType('in'); return; }
    if (label === 'Punch Out') { setPunchType('out'); return; }
    const route = ACTION_ROUTES[label];
    if (route) { router.push(route); return; }
    setActionNote(`"${label}" lives on this workspace's detail screens — open the records below to act on it.`);
    window.setTimeout(() => setActionNote(''), 4000);
  };

  const query = useQuery({
    queryKey: ['stitch-page', config.title, config.endpoints],
    queryFn: async () => {
      const responses = await Promise.allSettled(config.endpoints.map((endpoint) => apiClient.get(endpoint)));
      return responses.map((response) => (response.status === 'fulfilled' ? response.value.data : null));
    },
    retry: 1,
  });

  const liveItems = useMemo(() => {
    const rows = flattenData(query.data ?? []);
    return rows.map((row, index): ListItem => ({
      title: toTitle(row, config.primaryItems[index % config.primaryItems.length]?.title ?? 'Live record'),
      subtitle: toSubtitle(row, config.primaryItems[index % config.primaryItems.length]?.subtitle ?? 'Synced from backend'),
      meta: row && typeof row === 'object' ? String((row as Record<string, unknown>)['createdAt'] ?? (row as Record<string, unknown>)['date'] ?? 'Live') : 'Live',
      status: row && typeof row === 'object' ? String((row as Record<string, unknown>)['status'] ?? 'Active') : 'Active',
    }));
  }, [query.data, config.primaryItems]);

  const items = liveItems.length ? liveItems : config.primaryItems;
  const secondaryItems = config.secondaryItems;
  const layout = config.layout ?? 'board';

  const header = (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-sm border-b border-outline-variant/30 pb-sm">
      <div>
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">{config.icon}</span>
          {config.eyebrow}
        </div>
        <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">{config.title}</h2>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">{config.title}</h2>
        <p className="text-on-surface-variant mt-xs max-w-3xl">{config.description}</p>
      </div>
      <DataBadge tone={query.isSuccess ? 'tertiary' : 'muted'}>{query.isLoading ? 'Syncing' : 'Backend Connected'}</DataBadge>
    </div>
  );

  const aiPanel = (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-md">
      <div className="glass-card rounded-xl p-md flex flex-col gap-sm border-l-4 border-l-primary ai-shimmer">
        <div className="flex items-center gap-sm text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          <h3 className="font-title-md text-title-md">Ask AI</h3>
        </div>
        <p className="text-body-sm text-on-surface-variant flex-1">{config.aiPrompt}</p>
        <div className="relative mt-auto">
          <input className="w-full border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-body-sm px-0 py-2 bg-transparent placeholder:text-on-surface-variant/50" placeholder="Ask about this workspace..." value={question} onChange={(event) => setQuestion(event.target.value)} />
          <button className="absolute right-0 top-2 text-primary hover:text-primary-container" aria-label="Send AI question">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
      <div className="lg:col-span-2 glass-card rounded-xl p-md flex flex-col gap-sm bg-surface-container-low/50">
        <div className="flex justify-between items-center">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">INTELLIGENCE BRIEF</h3>
          <span className="material-symbols-outlined text-outline">auto_awesome</span>
        </div>
        <h4 className="font-title-md text-title-md text-on-surface mt-xs">{config.title} Signal</h4>
        <p className="text-body-sm text-on-surface-variant leading-relaxed">{config.aiSummary}</p>
      </div>
    </section>
  );

  /* Compact AI panel for narrow sidebars — stacks vertically */
  const aiPanelCompact = (
    <div className="flex flex-col gap-sm">
      <div className="glass-card rounded-xl p-md flex flex-col gap-sm border-l-4 border-l-primary ai-shimmer">
        <div className="flex items-center gap-sm text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          <h3 className="font-title-md text-title-md">Ask AI</h3>
        </div>
        <p className="text-body-sm text-on-surface-variant">{config.aiPrompt}</p>
        <div className="relative">
          <input className="w-full border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-body-sm px-0 py-2 bg-transparent placeholder:text-on-surface-variant/50" placeholder="Ask about this workspace..." value={question} onChange={(event) => setQuestion(event.target.value)} />
          <button className="absolute right-0 top-2 text-primary hover:text-primary-container" aria-label="Send AI question">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
      <div className="glass-card rounded-xl p-md flex flex-col gap-sm bg-surface-container-low/50">
        <div className="flex justify-between items-center">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">INTELLIGENCE BRIEF</h3>
          <span className="material-symbols-outlined text-outline">auto_awesome</span>
        </div>
        <h4 className="font-title-sm text-on-surface font-semibold mt-xs">{config.title} Signal</h4>
        <p className="text-body-sm text-on-surface-variant leading-relaxed">{config.aiSummary}</p>
      </div>
    </div>
  );

  const metricGrid = (
    <section>
      <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-sm tracking-widest">LIVE OPERATING METRICS</h3>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-sm">
        {config.metrics.map((metric) => (
          <div key={metric.label} className="glass-card rounded-lg p-sm flex flex-col gap-xs hover:-translate-y-1 transition-transform duration-300">
            <span className="font-label-caps text-label-caps text-on-surface-variant">{metric.label}</span>
            <div className="font-headline-lg text-headline-lg text-on-surface">{metric.value}</div>
            <div className={`flex items-center gap-xs text-sm font-label-caps text-label-caps ${metric.tone === 'error' ? 'text-error' : metric.tone === 'tertiary' ? 'text-tertiary' : metric.tone === 'primary' ? 'text-primary' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined text-sm">{metric.icon}</span>
              {metric.meta}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  /* Compact metric grid for narrow sidebars — 2 columns, smaller value text */
  const metricGridCompact = (
    <section>
      <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-sm tracking-widest">LIVE OPERATING METRICS</h3>
      <div className="grid grid-cols-2 gap-sm">
        {config.metrics.map((metric) => (
          <div key={metric.label} className="glass-card rounded-lg p-sm flex flex-col gap-xs hover:-translate-y-1 transition-transform duration-300">
            <span className="font-label-caps text-[10px] text-on-surface-variant truncate">{metric.label}</span>
            <div className="font-title-lg text-title-lg text-on-surface font-bold truncate">{metric.value}</div>
            <div className={`flex items-center gap-xs font-label-caps text-[10px] truncate ${metric.tone === 'error' ? 'text-error' : metric.tone === 'tertiary' ? 'text-tertiary' : metric.tone === 'primary' ? 'text-primary' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined text-sm shrink-0">{metric.icon}</span>
              <span className="truncate">{metric.meta}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const queueList = (
    <div className="glass-card rounded-xl flex flex-col divide-y divide-outline-variant/30 overflow-hidden">
      {items.slice(0, 5).map((item, index) => (
        <div key={`${item.title}-${index}`} className="p-sm flex justify-between items-center gap-sm hover:bg-surface-container-low transition-colors">
          <div className="flex items-start gap-sm min-w-0">
            <div className="bg-secondary-container text-on-secondary-container w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0">
              {item.initials ?? item.title.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-title-md text-title-md text-on-surface text-base truncate">{item.title}</p>
              <p className="text-body-sm text-on-surface-variant truncate">{item.subtitle}</p>
            </div>
          </div>
          <DataBadge tone={item.status?.toLowerCase().includes('risk') || item.status?.toLowerCase().includes('gap') ? 'error' : 'muted'}>{item.status ?? item.meta ?? 'Review'}</DataBadge>
        </div>
      ))}
    </div>
  );

  if (layout === 'workday') {
    return (
      <div className="max-w-[980px] mx-auto w-full flex flex-col gap-lg">
        {header}
      {actionNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {actionNote}
        </div>
      )}
      {punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-lg flex flex-col md:flex-row items-center justify-between gap-lg relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col items-center md:items-start gap-sm z-10 text-center md:text-left">
            <div className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">CURRENT SHIFT</div>
            <div className="font-display-lg text-display-lg text-on-background tabular-nums">08:42 <span className="text-title-md text-on-surface-variant">AM</span></div>
            <div className="font-body-sm text-body-sm text-tertiary flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              Headquarters - Zone A
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-sm w-full md:w-auto z-10">
            {(config.actions ?? []).slice(0, 3).map((action, index) => (
              <button key={action} onClick={() => runAction(action)} className={`${index === 0 ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface border border-outline-variant'} font-title-md text-title-md py-sm px-xl rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-xs cursor-pointer`}>
                <span className="material-symbols-outlined">{index === 0 ? 'fingerprint' : 'arrow_forward'}</span>
                {action}
              </button>
            ))}
          </div>
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
          <section className="lg:col-span-7 glass-card rounded-xl p-md">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-md tracking-widest">TODAY'S FLOW</h3>
            <div className="relative flex flex-col gap-md">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-outline-variant/40" />
              {items.slice(0, 4).map((item, index) => (
                <div key={item.title} className="relative z-10 flex gap-md">
                  <div className={`mt-1 w-6 h-6 rounded-full border-4 ${index === 0 ? 'bg-primary border-primary/20' : 'bg-surface-container-highest border-surface-container-lowest'}`} />
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-sm flex-1">
                    <p className="font-semibold text-on-surface">{item.title}</p>
                    <p className="text-body-sm text-on-surface-variant">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <aside className="lg:col-span-5 flex flex-col gap-md">
            {metricGridCompact}
            {aiPanelCompact}
          </aside>
        </div>
      </div>
    );
  }

  if (layout === 'directory') {
    return (
      <div className="flex flex-col gap-lg">
        {header}
      {actionNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {actionNote}
        </div>
      )}
      {punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-lg">
          <aside className="flex flex-col gap-md">
            {aiPanelCompact}
            <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
              {(config.actions ?? []).map((action) => (
                <button key={action} onClick={() => runAction(action)} className="flex items-center justify-between rounded-lg bg-surface-container-lowest px-sm py-3 text-left font-label-caps text-label-caps text-primary hover:bg-surface-container-high cursor-pointer">
                  {action}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex flex-col gap-md">
            {metricGrid}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
              {items.slice(0, 9).map((item, index) => (
                <article key={`${item.title}-${index}`} className="glass-card rounded-xl p-md flex flex-col gap-md border border-outline-variant/30">
                  <div className="flex items-center gap-sm">
                    <div className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold">{item.initials ?? item.title.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0">
                      <h3 className="font-title-md text-title-md text-on-surface text-base truncate">{item.title}</h3>
                      <p className="text-body-sm text-on-surface-variant truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-outline-variant/30 pt-sm">
                    <DataBadge tone="tertiary">{item.status ?? 'Active'}</DataBadge>
                    <span className="material-symbols-outlined text-primary">open_in_new</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (layout === 'finance') {
    return (
      <div className="flex flex-col gap-lg">
        {header}
      {actionNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {actionNote}
        </div>
      )}
      {punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-sm">
          {config.metrics.map((metric) => (
            <div key={metric.label} className="glass-card rounded-xl p-md min-h-[150px] flex flex-col justify-between">
              <span className="material-symbols-outlined text-primary">{metric.icon}</span>
              <div>
                <p className="font-label-caps text-label-caps text-on-surface-variant">{metric.label}</p>
                <p className="font-display-lg text-display-lg text-on-surface">{metric.value}</p>
                <p className="text-body-sm text-on-surface-variant">{metric.meta}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-lg">
          <section className="glass-card rounded-xl overflow-hidden">
            <div className="p-md border-b border-outline-variant/30 flex justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">APPROVAL LEDGER</h3>
              <DataBadge tone="primary">{items.length} Records</DataBadge>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {items.slice(0, 6).map((item, index) => (
                <div key={`${item.title}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px] gap-sm p-md items-center hover:bg-surface-container-low">
                  <div>
                    <p className="font-semibold text-on-surface">{item.title}</p>
                    <p className="text-body-sm text-on-surface-variant">{item.subtitle}</p>
                  </div>
                  <DataBadge tone={item.status?.toLowerCase().includes('risk') ? 'error' : 'muted'}>{item.status ?? 'Pending'}</DataBadge>
                  <button className="text-label-caps font-label-caps text-primary border border-outline-variant rounded-full px-3 py-2">Review</button>
                </div>
              ))}
            </div>
          </section>
          <aside className="flex flex-col gap-md">
            {aiPanel}
          </aside>
        </div>
      </div>
    );
  }

  if (layout === 'timeline') {
    return (
      <div className="flex flex-col gap-lg">
        {header}
      {actionNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {actionNote}
        </div>
      )}
      {punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-lg">
          <section className="glass-card rounded-xl p-md">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-md tracking-widest">TIMELINE</h3>
            <div className="relative flex flex-col gap-lg">
              <div className="absolute left-4 top-3 bottom-3 w-px bg-outline-variant" />
              {items.slice(0, 7).map((item, index) => (
                <div key={`${item.title}-${index}`} className="relative z-10 grid grid-cols-[34px_1fr] gap-sm">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-primary'}`}>
                    <span className="material-symbols-outlined text-[18px]">{config.icon}</span>
                  </div>
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-sm">
                    <div className="flex justify-between gap-sm">
                      <p className="font-semibold text-on-surface">{item.title}</p>
                      <DataBadge tone={item.status?.toLowerCase().includes('risk') || item.status?.toLowerCase().includes('gap') ? 'error' : 'muted'}>{item.status ?? 'Logged'}</DataBadge>
                    </div>
                    <p className="text-body-sm text-on-surface-variant mt-1">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <aside className="flex flex-col gap-md">
            {metricGridCompact}
            {aiPanelCompact}
          </aside>
        </div>
      </div>
    );
  }

  if (layout === 'chat') {
    return (
      <div className="flex flex-col gap-lg">
        {header}
      {actionNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {actionNote}
        </div>
      )}
      {punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-md min-h-[640px]">
          <aside className="glass-card rounded-xl overflow-hidden">
            <div className="p-md border-b border-outline-variant/30">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">CHANNELS</h3>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {items.slice(0, 6).map((item, index) => (
                <button key={`${item.title}-${index}`} className={`w-full text-left p-sm flex gap-sm hover:bg-surface-container-low ${index === 0 ? 'bg-secondary-container/60' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold">{item.title.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface truncate">{item.title}</p>
                    <p className="text-body-sm text-on-surface-variant truncate">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <section className="glass-card rounded-xl p-md flex flex-col gap-md">
            <div className="border-b border-outline-variant/30 pb-sm">
              <h3 className="font-title-md text-title-md text-on-surface">{items[0]?.title ?? 'Management Channel'}</h3>
              <p className="text-body-sm text-on-surface-variant">Operational thread</p>
            </div>
            <div className="flex-1 flex flex-col gap-sm">
              {secondaryItems.concat(items).slice(0, 5).map((item, index) => (
                <div key={`${item.title}-${index}`} className={`max-w-[78%] rounded-xl p-sm ${index % 2 ? 'self-end bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface border border-outline-variant/30'}`}>
                  <p className="font-semibold">{item.title}</p>
                  <p className={`text-body-sm ${index % 2 ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{item.subtitle}</p>
                </div>
              ))}
            </div>
            <div className="rounded-full bg-surface-container-lowest border border-outline-variant/40 px-sm py-2 flex items-center gap-sm">
              <span className="material-symbols-outlined text-on-surface-variant">add</span>
              <input className="flex-1 bg-transparent border-0 focus:ring-0 text-body-sm" placeholder="Type a message..." />
              <span className="material-symbols-outlined text-primary">send</span>
            </div>
          </section>
          <aside className="flex flex-col gap-md">
            {metricGridCompact}
            {aiPanelCompact}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      {header}
      {actionNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {actionNote}
        </div>
      )}
      {punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
      {layout === 'command' ? aiPanel : metricGrid}
      {layout === 'command' ? metricGrid : aiPanel}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <section className="flex flex-col gap-sm">
          <div className="flex justify-between items-center mb-xs">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">ACTIVE WORK QUEUE</h3>
            <DataBadge tone="primary">{items.length} Items</DataBadge>
          </div>
          {queueList}
        </section>

        <section className="flex flex-col gap-sm">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-xs tracking-widest">NEXT BEST ACTIONS</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
            {secondaryItems.map((item, index) => (
              <div key={`${item.title}-${index}`} className="glass-card rounded-xl p-sm flex flex-col gap-sm cursor-pointer hover:bg-surface-container-low transition-colors border border-outline-variant/30 group">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">{index % 2 ? 'rate_review' : 'assignment'}</span>
                </div>
                <div>
                  <h4 className="font-title-md text-title-md text-on-surface text-base">{item.title}</h4>
                  <p className="text-body-sm text-on-surface-variant mt-1">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card rounded-xl p-sm flex flex-wrap gap-xs mt-xs">
            {(config.actions ?? ['Export', 'Review', 'Notify']).map((action) => (
              <button key={action} onClick={() => runAction(action)} className="text-label-caps font-label-caps text-primary border border-outline-variant px-3 py-2 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer">
                {action}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
