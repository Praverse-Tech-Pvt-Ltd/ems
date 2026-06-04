'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';

const PROGRESS_COLOR: Record<string, string> = {
  Complete: 'bg-green-100 text-green-800 border-green-300',
  Partial: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  'Not Started': 'bg-gray-100 text-gray-600 border-gray-300',
  Blocked: 'bg-red-50 text-red-800 border-red-300',
};

export default function WorkUpdatesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
  const [showForm, setShowForm] = useState(false);
  const [rawText, setRawText] = useState('');
  const [updateDate, setUpdateDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [companyId, setCompanyId] = useState('');
  const [view, setView] = useState<'my' | 'all'>('my');
  const [filterReview, setFilterReview] = useState(false);
  const qc = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['client-companies-list'],
    queryFn: () => apiClient.get('/client-companies').then(r => r.data),
  });

  const endpoint = view === 'my' ? '/work-updates/my' : '/work-updates';
  const { data, isLoading } = useQuery({
    queryKey: ['work-updates', view, filterReview],
    queryFn: () => apiClient.get(endpoint, {
      params: filterReview ? { needsReview: true } : {},
    }).then(r => r.data),
  });

  const { mutate: submit, isPending, data: submitResult, reset } = useMutation({
    mutationFn: () => apiClient.post('/work-updates', { rawText, updateDate, companyId: companyId || undefined }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-updates'] });
      setRawText('');
      setUpdateDate(format(new Date(), 'yyyy-MM-dd'));
      setCompanyId('');
      setShowForm(false);
    },
  });

  const { mutate: reviewUpdate } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/work-updates/${id}/review`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-updates'] }),
  });

  const updates = data?.items ?? [];

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Work Updates"
        subtitle="Employee updates — AI converts raw notes into structured data"
        actions={
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <>
                <div className="flex brutal-border overflow-hidden">
                  {['my', 'all'].map(v => (
                    <button key={v} onClick={() => setView(v as any)}
                      className={`px-3 py-1.5 font-display font-bold text-[11px] uppercase transition-colors ${view === v ? 'bg-brutal-ink text-white' : 'bg-white'}`}>
                      {v}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFilterReview(!filterReview)}
                  className={`brutal-border px-3 py-1.5 text-[11px] font-display font-bold transition-colors ${filterReview ? 'bg-orange-500 text-white' : 'bg-white'}`}
                >
                  {filterReview ? 'Needs Review' : 'Filter'}
                </button>
              </>
            )}
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Add Update
            </Button>
          </div>
        }
      />

      {showForm && (
        <div className="brutal-border p-4 mb-5 bg-brutal-surface">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-[12px] tracking-widest uppercase">Submit Work Update</h3>
            <button onClick={() => setShowForm(false)} className="brutal-border w-7 h-7 grid place-items-center hover:bg-white">
              <X size={13} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">Date</label>
                <input type="date" value={updateDate} onChange={e => setUpdateDate(e.target.value)} className="brutal-border p-2 text-sm font-display outline-none bg-white" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">Company (optional)</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white">
                  <option value="">AI will detect from text</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">Work Update *</label>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={4}
                placeholder={'Example: "Worked on West Coast audit checklist. Completed production document review. Pending QA SOP verification."'}
                className="w-full brutal-border p-3 text-sm font-display outline-none resize-none bg-white placeholder:text-brutal-ink/30"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button disabled={!rawText.trim() || isPending} onClick={() => submit()}>
                {isPending ? 'AI Processing…' : 'Submit Update'}
              </Button>
              <span className="text-[11px] text-brutal-ink/50 font-display">AI extracts tasks, status, and next actions</span>
            </div>
          </div>

          {submitResult && (
            <div className="mt-3 bg-green-50 border-2 border-green-300 p-3">
              <div className="font-display font-bold text-[11px] text-green-700 mb-2">✓ Update submitted — AI extracted:</div>
              <div className="grid grid-cols-2 gap-2">
                {submitResult.extracted?.companyName && <InfoPill label="Company" value={submitResult.extracted.companyName} />}
                {submitResult.extracted?.taskCompleted && <InfoPill label="Completed" value={submitResult.extracted.taskCompleted} />}
                {submitResult.extracted?.pendingTask && <InfoPill label="Pending" value={submitResult.extracted.pendingTask} />}
                {submitResult.extracted?.workStatus && <InfoPill label="Status" value={submitResult.extracted.workStatus} />}
                {submitResult.extracted?.nextAction && <InfoPill label="Next Action" value={submitResult.extracted.nextAction} />}
                {submitResult.extracted?.progress && <InfoPill label="Progress" value={submitResult.extracted.progress} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Updates list */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 brutal-border bg-brutal-surface animate-pulse" />)}</div>
      ) : updates.length === 0 ? (
        <div className="brutal-border p-12 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-brutal-ink/30" />
          <p className="font-display font-bold text-brutal-ink/40">No updates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u: any) => (
            <div key={u.id} className={`brutal-border p-4 bg-white ${u.needsAdminReview && !u.reviewedBy ? 'border-orange-400' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {(view === 'all' || isAdmin) && u.employee && (
                    <span className="font-display font-bold text-[12px]">
                      {u.employee.firstName} {u.employee.lastName}
                    </span>
                  )}
                  {u.company && (
                    <span className="text-[11px] font-bold bg-brutal-yellow px-2 py-0.5">{u.company.name}</span>
                  )}
                  {!u.company && u.companyName && (
                    <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 border border-orange-300">? {u.companyName}</span>
                  )}
                  {u.progress && (
                    <span className={`text-[10px] font-display font-bold px-1.5 py-0.5 border ${PROGRESS_COLOR[u.progress] ?? 'bg-brutal-surface border-brutal-ink/20'}`}>
                      {u.progress}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-brutal-ink/40 font-display">{format(new Date(u.updateDate), 'dd MMM')}</span>
                  {isAdmin && u.needsAdminReview && !u.reviewedBy && (
                    <div className="flex gap-1">
                      <button onClick={() => reviewUpdate({ id: u.id, status: 'APPROVED' })} className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 hover:bg-green-600">✓</button>
                      <button onClick={() => reviewUpdate({ id: u.id, status: 'NEEDS_CORRECTION' })} className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 hover:bg-red-600">✗</button>
                    </div>
                  )}
                  {u.status === 'APPROVED' && <CheckCircle size={12} className="text-green-500" />}
                  {u.status === 'NEEDS_CORRECTION' && <AlertCircle size={12} className="text-brutal-red" />}
                </div>
              </div>

              <p className="text-[12px] text-brutal-ink/80 italic mb-2">"{u.rawText}"</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {u.taskCompleted && <InfoPill label="Completed" value={u.taskCompleted} />}
                {u.pendingTask && <InfoPill label="Pending" value={u.pendingTask} />}
                {u.workStatus && <InfoPill label="Status" value={u.workStatus} />}
                {u.contribution && <InfoPill label="Contribution" value={u.contribution} />}
                {u.nextAction && <InfoPill label="Next Action" value={u.nextAction} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brutal-surface border border-brutal-ink/10 px-2 py-1">
      <div className="font-display font-bold text-[9px] uppercase text-brutal-ink/40">{label}</div>
      <div className="font-display text-[11px] text-brutal-ink truncate" title={value}>{value}</div>
    </div>
  );
}
