'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PunchModal } from '@/components/PunchModal';
import { useAuthStore } from '@/store/auth.store';

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

function WorkdayClock() {
  const [time, setTime] = useState({ h: '', m: '', ampm: '' });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const h = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: true }).replace(/\s?(AM|PM)/i, '');
      const m = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minute: '2-digit' }).padStart(2, '0');
      const ampm = d.getHours() < 12 ? 'AM' : 'PM';
      setTime({ h, m, ampm });
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-end gap-1 leading-none">
      <span className="text-[40px] font-black text-on-surface tabular-nums tracking-tight" style={{ letterSpacing: '-0.03em' }}>
        {time.h || '--'}:{time.m || '--'}
      </span>
      <span className="text-[15px] font-bold text-on-surface-variant mb-1.5">{time.ampm}</span>
    </div>
  );
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

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
  const user = useAuthStore(s => s.user);
  const isAshwani = user?.email?.toLowerCase() === 'ashwani@nexgenpharmasolutions.com';
  const [question, setQuestion] = useState('');
  const [punchType, setPunchType] = useState<'in' | 'out' | null>(null);
  const [odMode, setOdMode] = useState<'in' | 'out' | null>(null);
  const [odPunchInTime, setOdPunchInTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [odPunchOutTime, setOdPunchOutTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [odReason, setOdReason] = useState('');
  const [odSubmitting, setOdSubmitting] = useState(false);
  const [actionNote, setActionNote] = useState('');

  // Fetch today's attendance only for workday layout to determine punch state
  const todayQuery = useQuery({
    queryKey: ['attendance-today', user?.id],
    queryFn: () => apiClient.get('/attendance/today').then(r => r.data),
    enabled: config.layout === 'workday' && !!user?.id,
    retry: false,
  });
  const todayData = todayQuery.data as { punchInTime?: string | null; punchOutTime?: string | null } | undefined;
  const isPunchedIn  = !!(todayData?.punchInTime && !todayData?.punchOutTime);
  const isPunchedOut = !!(todayData?.punchInTime && todayData?.punchOutTime);
  const openOdQuery = useQuery({
    queryKey: ['attendance-od-open', user?.id],
    queryFn: () => apiClient.get('/attendance/od/open').then(r => r.data),
    enabled: config.layout === 'workday' && !isAshwani && !!user?.id,
    retry: false,
  });
  const openOd = openOdQuery.data as { id?: string; punchInTime?: string | null; manualPunchReason?: string | null } | null | undefined;
  const visibleActions = (config.actions ?? []).filter(action => {
    if (!isAshwani) return true;
    return !['Punch In', 'Punch Out', 'OD', 'Regularize'].includes(action);
  });
  const visibleMetrics = config.metrics.filter(metric => {
    if (!isAshwani) return true;
    return !['Punch', 'Today Status', 'Regularize', 'Policy Use', 'Face Proxy'].includes(metric.label);
  });

  const runAction = (label: string) => {
    if (isAshwani && ['Punch In', 'Punch Out', 'OD', 'Regularize'].includes(label)) return;
    if (label === 'Punch In') { setPunchType('in'); return; }
    if (label === 'Punch Out') { setPunchType('out'); return; }
    if (label === 'OD') {
      if (openOd?.id) {
        setOdMode('out');
        setOdPunchOutTime(toDateTimeLocalValue(new Date()));
        setOdReason(openOd.manualPunchReason === 'OD' ? '' : openOd.manualPunchReason ?? '');
      } else {
        setOdMode('in');
        setOdPunchInTime(toDateTimeLocalValue(new Date()));
        setOdReason('');
      }
      return;
    }
    const route = ACTION_ROUTES[label];
    if (route) { router.push(route); return; }
    setActionNote(`"${label}" lives on this workspace's detail screens — open the records below to act on it.`);
    window.setTimeout(() => setActionNote(''), 4000);
  };

  useEffect(() => {
    if (config.layout !== 'workday' || !openOd?.id) return;
    setOdMode('out');
    setOdPunchOutTime(toDateTimeLocalValue(new Date()));
    setOdReason(openOd.manualPunchReason === 'OD' ? '' : openOd.manualPunchReason ?? '');
  }, [config.layout, openOd?.id, openOd?.manualPunchReason]);

  const submitOdPunchIn = async () => {
    setOdSubmitting(true);
    try {
      await apiClient.post('/attendance/od/punch-in', {
        punchInTime: new Date(odPunchInTime).toISOString(),
        reason: odReason || undefined,
      });
      setActionNote('OD punch-in time saved. Add punch-out time when duty is complete.');
      setOdMode(null);
      await Promise.all([todayQuery.refetch(), openOdQuery.refetch()]);
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Could not save OD punch-in.';
      setActionNote(Array.isArray(message) ? message.join('. ') : message);
    } finally {
      setOdSubmitting(false);
    }
  };

  const submitOdPunchOut = async () => {
    setOdSubmitting(true);
    try {
      await apiClient.post('/attendance/od/punch-out', {
        punchOutTime: new Date(odPunchOutTime).toISOString(),
        reason: odReason || undefined,
      });
      setActionNote('OD punch-out time saved.');
      setOdMode(null);
      await Promise.all([todayQuery.refetch(), openOdQuery.refetch()]);
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Could not save OD punch-out.';
      setActionNote(Array.isArray(message) ? message.join('. ') : message);
    } finally {
      setOdSubmitting(false);
    }
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
      <div className="glass-card rounded-xl p-md flex flex-col gap-sm border-l-4 border-l-primary ai-shimmer bg-gradient-to-br from-primary/5 via-transparent to-secondary/5">
        <div className="flex items-center gap-sm text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          <h3 className="font-title-md text-title-md">Ask AI</h3>
        </div>
        <p className="text-body-sm text-secondary flex-1">{config.aiPrompt}</p>
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
        {visibleMetrics.map((metric) => (
          <div key={metric.label} className={`glass-card rounded-lg p-sm flex flex-col gap-xs card-hover ${metric.tone === 'primary' ? 'border-l-[3px] border-l-primary' : metric.tone === 'tertiary' ? 'border-l-[3px] border-l-tertiary' : metric.tone === 'error' ? 'border-l-[3px] border-l-error' : ''}`}>
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
        {visibleMetrics.map((metric) => (
          <div key={metric.label} className={`glass-card rounded-lg p-sm flex flex-col gap-xs card-hover ${metric.tone === 'primary' ? 'border-l-[3px] border-l-primary' : metric.tone === 'tertiary' ? 'border-l-[3px] border-l-tertiary' : metric.tone === 'error' ? 'border-l-[3px] border-l-error' : ''}`}>
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
    const actionIcons: Record<string, string> = {
      'Punch In': 'login', 'Punch Out': 'logout',
      'OD': 'work_history', 'Apply Leave': 'event_available', 'View Payslip': 'payments',
    };
    return (
      <div className="max-w-[1040px] mx-auto w-full flex flex-col gap-5 pb-6">
        {!isAshwani && punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        {!isAshwani && odMode && (
          <div className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-sm flex items-center justify-center p-md">
            <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl p-lg">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="font-label-caps text-label-caps text-primary tracking-widest">
                    {odMode === 'in' ? 'OD PUNCH IN' : 'OD PUNCH OUT'}
                  </p>
                  <h3 className="font-title-lg text-title-lg text-on-surface mt-xs">
                    {odMode === 'in' ? 'Enter OD start time' : 'Complete OD entry'}
                  </h3>
                  {odMode === 'out' && openOd?.punchInTime && (
                    <p className="text-sm text-on-surface-variant mt-xs">
                      OD started at {new Date(openOd.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOdMode(null)}
                  className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  aria-label="Close OD form"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="mt-md space-y-sm">
                <label className="block">
                  <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">
                    {odMode === 'in' ? 'Punch In Time' : 'Punch Out Time'}
                  </span>
                  <input
                    type="datetime-local"
                    value={odMode === 'in' ? odPunchInTime : odPunchOutTime}
                    onChange={(event) => odMode === 'in' ? setOdPunchInTime(event.target.value) : setOdPunchOutTime(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-sm py-2 text-on-surface focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">OD Note</span>
                  <input
                    value={odReason}
                    onChange={(event) => setOdReason(event.target.value)}
                    placeholder="Client visit, field work, travel..."
                    className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-sm py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-lg flex gap-sm justify-end">
                <button
                  type="button"
                  onClick={() => setOdMode(null)}
                  className="px-4 py-2 rounded-full border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={odMode === 'in' ? submitOdPunchIn : submitOdPunchOut}
                  disabled={odSubmitting}
                  className="px-5 py-2 rounded-full bg-primary text-on-primary font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {odSubmitting ? 'Saving...' : odMode === 'in' ? 'Save OD In' : 'Save OD Out'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Page title row ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap pt-1">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-primary tracking-[0.09em] uppercase mb-1">
              <span className="material-symbols-outlined text-[15px]">{config.icon}</span>
              {config.eyebrow}
            </div>
            <h1 className="text-[26px] font-black text-on-surface leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              My Workday
            </h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5">{config.description}</p>
          </div>
          {!isAshwani && <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
            isPunchedIn  ? 'bg-success/10 text-success border border-success/20' :
            isPunchedOut ? 'bg-secondary/10 text-secondary border border-secondary/20' :
            todayQuery.isLoading ? 'bg-on-surface-variant/8 text-on-surface-variant border border-card-border' :
                           'bg-tertiary/10 text-tertiary border border-tertiary/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isPunchedIn ? 'bg-success animate-pulse' : isPunchedOut ? 'bg-secondary' : 'bg-tertiary/50'
            }`} />
            {todayQuery.isLoading ? 'Syncing…' : isPunchedIn ? 'Punched In' : isPunchedOut ? 'Punched Out' : 'Not Punched'}
          </div>}
        </div>

        {actionNote && (
          <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">info</span>
            {actionNote}
          </div>
        )}

        {/* ── Hero punch card ── */}
        {!isAshwani && <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(170,48,0,0.08) 0%, rgba(1,103,125,0.06) 60%, rgba(250,248,255,0) 100%)',
            border: '1px solid rgba(226,191,181,0.5)',
            boxShadow: '0 4px 24px rgba(19,27,46,0.06)',
          }}
        >
          {/* decorative blobs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(170,48,0,0.09) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(1,103,125,0.08) 0%, transparent 70%)' }} />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            {/* Left — time + location */}
            <div className="flex flex-col gap-2">
              <div className="text-[10.5px] font-bold text-on-surface-variant/60 tracking-[0.09em] uppercase">Current Shift</div>
              <WorkdayClock />
              {isPunchedIn && todayData?.punchInTime && (
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-success">
                  <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>login</span>
                  In since {new Date(todayData.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              )}
              {isPunchedOut && todayData?.punchOutTime && (
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-secondary">
                  <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>logout</span>
                  Out at {new Date(todayData.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-secondary">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                Headquarters – Zone A
              </div>
            </div>

            {/* Right — action buttons */}
            <div className="flex flex-row sm:flex-row flex-wrap gap-2 w-full md:w-auto">
              {visibleActions.slice(0, 4).map((rawAction, index) => {
                // Dynamically swap "Punch In" → "Punch Out" when user is already clocked in
                const action = (index === 0 && rawAction === 'Punch In' && isPunchedIn) ? 'Punch Out' : rawAction;
                const icon = actionIcons[action] ?? (index === 0 ? 'fingerprint' : 'arrow_forward');
                const isPrimary = index === 0;
                const isDisabled = !!openOd?.id && (action === 'Punch In' || action === 'Punch Out');
                return (
                  <button
                    key={rawAction}
                    onClick={() => runAction(action)}
                    disabled={isDisabled}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[12px] sm:text-[13.5px] font-bold transition-all duration-150 active:scale-95 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={isPrimary ? (
                      action === 'Punch Out'
                        ? { background: 'linear-gradient(135deg, #01677d 0%, #015f73 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(1,103,125,0.30)' }
                        : { background: 'linear-gradient(135deg, #aa3000 0%, #c53800 100%)', color: '#fff', boxShadow: '0 4px 16px rgba(170,48,0,0.30)' }
                    ) : {
                      background: 'rgba(255,255,255,0.85)',
                      border: '1px solid rgba(226,191,181,0.6)',
                      color: '#131b2e',
                      boxShadow: '0 2px 8px rgba(19,27,46,0.06)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={isPrimary ? { fontVariationSettings: "'FILL' 1" } : {}}
                    >
                      {icon}
                    </span>
                    {action}
                  </button>
                );
              })}
            </div>
          </div>
        </div>}

        {/* ── Quick stat chips ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {visibleMetrics.map(metric => {
            const accent = metric.tone === 'primary' ? '#aa3000' : metric.tone === 'tertiary' ? '#01677d' : metric.tone === 'error' ? '#ba1a1a' : '#59413a';
            return (
              <div
                key={metric.label}
                className="glass-card rounded-2xl p-4 flex flex-col gap-3 card-hover"
                style={{ borderLeft: `3px solid ${accent}` }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}12` }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: accent, fontVariationSettings: "'FILL' 1" }}>{metric.icon}</span>
                </div>
                <div>
                  <div className="text-[18px] font-bold text-on-surface leading-none">{metric.value}</div>
                  <div className="text-[11px] text-on-surface-variant mt-0.5 font-medium">{metric.label}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: accent }}>{metric.meta}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Main grid ── */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_300px] gap-4">

          {/* Today's activity timeline */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-on-surface-variant/60 tracking-[0.08em] uppercase">Today's Activity</h3>
              <span className="text-[11px] text-secondary font-semibold">View all →</span>
            </div>
            <div className="relative flex flex-col gap-0">
              <div className="absolute left-[17px] top-3 bottom-3 w-0.5" style={{ background: 'rgba(226,191,181,0.5)' }} />
              {items.slice(0, 5).map((item, index) => {
                const isFirst = index === 0;
                const dotColor = isFirst ? '#aa3000' : index === 1 ? '#01677d' : '#b8a89a';
                return (
                  <div key={`${item.title}-${index}`} className="relative z-10 flex gap-4 pb-4 last:pb-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${dotColor}12`, border: `1.5px solid ${dotColor}30` }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-on-surface leading-tight">{item.title}</p>
                        {item.status && (
                          <span className={`chip border text-[10px] flex-shrink-0 mt-0.5 ${
                            item.status === 'Priority' ? 'bg-error/10 text-error border-error/20'
                            : item.status === 'Ready' ? 'bg-success/10 text-success border-success/20'
                            : 'bg-tertiary/10 text-tertiary border-tertiary/20'
                          }`}>{item.status}</span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-on-surface-variant mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column — AI + quick actions */}
          <div className="flex flex-col gap-4">
            {/* AI panel */}
            <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 border-l-[3px] border-l-primary" style={{ background: 'linear-gradient(135deg, rgba(170,48,0,0.04) 0%, rgba(1,103,125,0.03) 100%)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10">
                  <span className="material-symbols-outlined text-[15px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                </div>
                <span className="text-[12.5px] font-bold text-on-surface">Ask AI</span>
              </div>
              <p className="text-[11.5px] text-secondary leading-relaxed">{config.aiPrompt}</p>
              <div className="relative">
                <input
                  className="w-full rounded-xl px-3 py-2 text-[12.5px] bg-card border border-card-border focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-variant/40"
                  placeholder="Ask about today…"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                />
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary hover:opacity-70 transition-opacity">
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
              </div>
            </div>

            {/* Quick links */}
            <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
              <h3 className="text-[11px] font-bold text-on-surface-variant/60 tracking-[0.08em] uppercase mb-1">Quick Actions</h3>
              {secondaryItems.map(item => (
                <div
                  key={item.title}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
                  style={{ border: '1px solid rgba(226,191,181,0.3)' }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-secondary/10 flex-shrink-0">
                    <span className="material-symbols-outlined text-[14px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-on-surface truncate">{item.title}</p>
                    <p className="text-[11px] text-on-surface-variant/60 truncate">{item.subtitle}</p>
                  </div>
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant/30 flex-shrink-0">chevron_right</span>
                </div>
              ))}
            </div>
          </div>
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
      {!isAshwani && punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="flex flex-col xl:grid xl:grid-cols-[300px_1fr] gap-lg">
          <aside className="flex flex-col gap-md">
            {aiPanelCompact}
            <div className="glass-card rounded-xl p-sm flex flex-col gap-xs">
              {visibleActions.map((action) => (
                <button key={action} onClick={() => runAction(action)} className="flex items-center justify-between rounded-lg bg-surface-container-lowest px-sm py-3 text-left font-label-caps text-label-caps text-primary hover:bg-surface-container-high cursor-pointer">
                  {action}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex flex-col gap-md">
            {metricGrid}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-sm">
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
      {!isAshwani && punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-sm">
          {visibleMetrics.map((metric) => (
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
        <div className="flex flex-col xl:grid xl:grid-cols-[1fr_380px] gap-lg">
          <section className="glass-card rounded-xl overflow-hidden">
            <div className="p-md border-b border-outline-variant/30 flex justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">APPROVAL LEDGER</h3>
              <DataBadge tone="primary">{items.length} Records</DataBadge>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {items.slice(0, 6).map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_120px] gap-sm p-md items-start sm:items-center hover:bg-surface-container-low">
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
      {!isAshwani && punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="flex flex-col xl:grid xl:grid-cols-[1fr_380px] gap-lg">
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
      {!isAshwani && punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
        <div className="flex flex-col xl:grid xl:grid-cols-[280px_1fr_280px] gap-md min-h-[500px] xl:min-h-[640px]">
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
      {!isAshwani && punchType && <PunchModal punchType={punchType} onClose={() => setPunchType(null)} />}
      {layout === 'command' ? aiPanel : metricGrid}
      {layout === 'command' ? metricGrid : aiPanel}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
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
            {(visibleActions.length ? visibleActions : ['Export', 'Review', 'Notify']).map((action) => (
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
