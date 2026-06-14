'use client';

import { useEffect, useState } from 'react';
import { aiProposalsService, workUpdatesService } from '@/lib/api/work-updates';
import { clientsService } from '@/lib/api/clients';
import { useAuthStore } from '@/store/auth.store';

export default function AdminApprovalsPage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [items, setItems] = useState<any[]>([]);
  const [workUpdates, setWorkUpdates] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyOverrides, setCompanyOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await aiProposalsService.all({ status: 'PENDING', limit: 100 }).catch(() => null);
      const updates = await workUpdatesService.all({ needsReview: true, limit: 100 }).catch(() => null);
      const allCompanies = await clientsService.list().catch(() => []);
      setItems(Array.isArray(data) ? data : data?.items ?? []);
      setWorkUpdates(Array.isArray(updates) ? updates : updates?.items ?? []);
      setCompanies(Array.isArray(allCompanies) ? allCompanies : allCompanies?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    setReviewing(id);
    try {
      if (action === 'approve') {
        const companyId = companyOverrides[id];
        await aiProposalsService.approve(id, companyId ? { companyId } : undefined);
      } else {
        await aiProposalsService.reject(id, 'Rejected by super admin');
      }
      await load();
    } finally {
      setReviewing(null);
    }
  };

  const reviewWorkUpdate = async (id: string, action: 'approve' | 'reject') => {
    setReviewing(id);
    try {
      await workUpdatesService.review(id, action === 'approve' ? 'APPROVED' : 'NEEDS_CORRECTION');
      await load();
    } finally {
      setReviewing(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-md text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">lock</span>
        <p className="text-on-surface-variant">Admin approvals are available only to Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">approval</span>
          ADMIN
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Admin Approvals</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Approvals</h2>
            <p className="text-on-surface-variant mt-xs">Approve AI-parsed updates before they update shared EMS data.</p>
          </div>
          <button onClick={load} className="border border-outline-variant/50 text-on-surface-variant font-label-caps text-label-caps px-4 py-2 rounded-full hover:bg-surface-container-low">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-lg text-center text-on-surface-variant">Loading pending approvals...</div>
      ) : items.length === 0 && workUpdates.length === 0 ? (
        <div className="glass-card rounded-2xl p-lg text-center text-on-surface-variant">No pending AI approvals.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-md">
          {workUpdates.map(update => (
            <div key={update.id} className="glass-card rounded-2xl border border-outline-variant/30 p-md flex flex-col gap-sm">
              <div className="flex items-start justify-between gap-sm">
                <div>
                  <p className="font-title-md text-title-md text-on-surface">Work Update Review</p>
                  <p className="text-body-sm text-on-surface-variant">
                    Submitted by {update.employee?.firstName} {update.employee?.lastName} · {new Date(update.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <span className="chip border bg-primary/10 text-primary border-primary/20">{update.status}</span>
              </div>

              <div className="rounded-xl bg-surface-container-low p-sm">
                <p className="font-label-caps text-[10px] text-on-surface-variant tracking-widest mb-xs">TEAM INPUT</p>
                <p className="text-body-sm text-on-surface whitespace-pre-wrap max-h-80 overflow-y-auto">{update.rawText}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-xs">
                {[
                  ['Company', update.company?.name ?? update.companyName],
                  ['Task Completed', update.taskCompleted],
                  ['Pending Task', update.pendingTask],
                  ['Work Status', update.workStatus],
                  ['Next Action', update.nextAction],
                  ['Update Date', update.updateDate ? new Date(update.updateDate).toLocaleDateString('en-IN') : null],
                ].filter(([, value]) => value).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-outline-variant/30 px-sm py-xs">
                    <p className="text-[10px] text-on-surface-variant">{label}</p>
                    <p className="text-body-sm text-on-surface">{String(value)}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-sm pt-xs">
                <button
                  onClick={() => reviewWorkUpdate(update.id, 'approve')}
                  disabled={reviewing === update.id}
                  className="flex-1 bg-tertiary text-on-primary font-label-caps text-label-caps py-2 rounded-full disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => reviewWorkUpdate(update.id, 'reject')}
                  disabled={reviewing === update.id}
                  className="flex-1 border border-error/30 text-error font-label-caps text-label-caps py-2 rounded-full disabled:opacity-50"
                >
                  Needs Correction
                </button>
              </div>
            </div>
          ))}

          {items.map(item => {
            const data = item.proposedData ?? {};
            return (
              <div key={item.id} className="glass-card rounded-2xl border border-outline-variant/30 p-md flex flex-col gap-sm">
                <div className="flex items-start justify-between gap-sm">
                  <div>
                    <p className="font-title-md text-title-md text-on-surface">{String(item.proposalType).replaceAll('_', ' ')}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      Submitted by {item.submitter?.firstName} {item.submitter?.lastName} · {new Date(item.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span className="chip border bg-primary/10 text-primary border-primary/20">PENDING</span>
                </div>

                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="font-label-caps text-[10px] text-on-surface-variant tracking-widest mb-xs">TEAM INPUT</p>
                  <p className="text-body-sm text-on-surface whitespace-pre-wrap">{item.rawInput}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-xs">
                  {[
                    ['Company', data.companyName],
                    ['Task Completed', data.taskCompleted],
                    ['Pending Task', data.pendingTask],
                    ['Next Action', data.nextAction ?? data.followUpAction],
                    ['Assigned To', data.assignedTo],
                    ['Due Date', data.dueDate ?? data.deadline],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-outline-variant/30 px-sm py-xs">
                      <p className="text-[10px] text-on-surface-variant">{label}</p>
                      <p className="text-body-sm text-on-surface">{String(value)}</p>
                    </div>
                  ))}
                </div>

                {item.aiReason && (
                  <p className="text-body-sm text-primary bg-primary/5 border border-primary/20 rounded-xl px-sm py-xs">AI note: {item.aiReason}</p>
                )}

                {!data.companyId && ['WORK_UPDATE', 'MEETING_NOTE', 'CLIENT_COMMUNICATION', 'FOLLOW_UP_TASK', 'CALENDAR_EVENT', 'COMPANY_STAGE_UPDATE'].includes(item.proposalType) && (
                  <div className="rounded-lg border border-error/30 bg-error/5 px-sm py-xs flex flex-col gap-xs">
                    <p className="text-[10px] text-error font-bold">
                      No matching company found{data.companyName ? ` for "${data.companyName}"` : ''}. Select one to link before approving.
                    </p>
                    <select
                      value={companyOverrides[item.id] ?? ''}
                      onChange={e => setCompanyOverrides(p => ({ ...p, [item.id]: e.target.value }))}
                      className="w-full border border-outline-variant/50 rounded-lg px-sm py-1.5 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none"
                    >
                      <option value="">— No company —</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-sm pt-xs">
                  <button
                    onClick={() => review(item.id, 'approve')}
                    disabled={reviewing === item.id}
                    className="flex-1 bg-tertiary text-on-primary font-label-caps text-label-caps py-2 rounded-full disabled:opacity-50"
                  >
                    Approve & Apply
                  </button>
                  <button
                    onClick={() => review(item.id, 'reject')}
                    disabled={reviewing === item.id}
                    className="flex-1 border border-error/30 text-error font-label-caps text-label-caps py-2 rounded-full disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
