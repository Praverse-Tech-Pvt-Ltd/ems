'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PenLine, Plus, CheckCircle, AlertCircle, X, ChevronDown, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';

export default function MeetingNotesPage() {
  const [showForm, setShowForm] = useState(false);
  const [filterReview, setFilterReview] = useState(false);
  const [rawText, setRawText] = useState('');
  const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [companyId, setCompanyId] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['meeting-notes', filterReview],
    queryFn: () => apiClient.get('/meeting-notes', { params: { needsReview: filterReview || undefined } }).then(r => r.data),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['client-companies-list'],
    queryFn: () => apiClient.get('/client-companies').then(r => r.data),
  });

  const { mutate: createNote, isPending, data: createResult, reset: resetCreate } = useMutation({
    mutationFn: () => apiClient.post('/meeting-notes', { rawText, meetingDate, companyId: companyId || undefined }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-notes'] });
      setRawText('');
      setMeetingDate(format(new Date(), 'yyyy-MM-dd'));
      setCompanyId('');
      setShowForm(false);
    },
  });

  const { mutate: reviewNote } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/meeting-notes/${id}/review`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-notes'] }),
  });

  const notes = data?.items ?? [];

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Meeting Notes"
        subtitle="Capture conversation notes — AI extracts structure automatically"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setFilterReview(!filterReview)}
              className={`brutal-border px-3 py-1.5 text-[11px] font-display font-bold transition-colors ${filterReview ? 'bg-orange-500 text-white' : 'bg-white'}`}
            >
              {filterReview ? 'Needs Review' : 'All Notes'}
            </button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Add Note
            </Button>
          </div>
        }
      />

      {/* Add form */}
      {showForm && (
        <div className="brutal-border p-4 mb-5 bg-brutal-surface">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-[12px] tracking-widest uppercase">Capture Meeting Note</h3>
            <button onClick={() => setShowForm(false)} className="brutal-border w-7 h-7 grid place-items-center hover:bg-white">
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">Meeting Date</label>
              <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
            <div>
              <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">Company (optional — AI will detect)</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white">
                <option value="">Auto-detect from note</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">Meeting Note *</label>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={5}
                placeholder={'Example: "Today I discussed with Nitya about Vemed WHO audit. She is preparing document checklist. Rishi will review validation documents by Monday."'}
                className="w-full brutal-border p-3 text-sm font-display outline-none resize-none bg-white placeholder:text-brutal-ink/30"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button disabled={!rawText.trim() || isPending} onClick={() => createNote()}>
                {isPending ? 'AI Processing…' : 'Save & Extract'}
              </Button>
              <span className="text-[11px] text-brutal-ink/50 font-display">Gemini AI will extract company, tasks, deadlines automatically</span>
            </div>
          </div>

          {createResult && (
            <div className="mt-3 bg-green-50 border-2 border-green-300 p-3">
              <div className="font-display font-bold text-[11px] text-green-700 mb-2">✓ Note saved — AI extracted:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {createResult.extracted?.companyName && <InfoPill label="Company" value={createResult.extracted.companyName} />}
                {createResult.extracted?.assignedTo && <InfoPill label="Assigned To" value={createResult.extracted.assignedTo} />}
                {createResult.extracted?.deadline && <InfoPill label="Deadline" value={createResult.extracted.deadline} />}
                {createResult.extracted?.priorityLevel && <InfoPill label="Priority" value={createResult.extracted.priorityLevel} />}
                {createResult.extracted?.pendingGap && <InfoPill label="Pending" value={createResult.extracted.pendingGap} />}
                {createResult.extracted?.followUpAction && <InfoPill label="Follow-up" value={createResult.extracted.followUpAction} />}
              </div>
              {createResult.needsAdminReview && (
                <div className="mt-2 text-[11px] text-orange-700 font-bold">⚠ Marked for admin review (company or assignee unclear)</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 brutal-border bg-brutal-surface animate-pulse" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="brutal-border p-12 text-center">
          <PenLine size={32} className="mx-auto mb-3 text-brutal-ink/30" />
          <p className="font-display font-bold text-brutal-ink/40">No meeting notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note: any) => (
            <div key={note.id} className={`brutal-border p-4 bg-white ${note.needsAdminReview && !note.adminReviewedBy ? 'border-orange-400' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {note.company && (
                    <span className="flex items-center gap-1 text-[11px] font-display font-bold bg-brutal-yellow px-2 py-0.5">
                      <Building2 size={9} /> {note.company.name}
                    </span>
                  )}
                  {!note.company && note.companyName && (
                    <span className="text-[11px] font-display font-bold text-orange-600 bg-orange-50 px-2 py-0.5 border border-orange-300">
                      ? {note.companyName}
                    </span>
                  )}
                  {note.priorityLevel && (
                    <span className={`text-[10px] font-display font-bold px-1.5 py-0.5 border ${
                      note.priorityLevel === 'HIGH' ? 'bg-red-50 border-red-300 text-red-700' :
                      note.priorityLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' :
                      'bg-green-50 border-green-300 text-green-700'
                    }`}>{note.priorityLevel}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-brutal-ink/40 font-display">
                    {note.enteredByEmployee.firstName} · {format(new Date(note.meetingDate), 'dd MMM')}
                  </span>
                  {note.needsAdminReview && !note.adminReviewedBy && (
                    <button
                      onClick={() => reviewNote(note.id)}
                      className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 hover:bg-orange-600"
                    >
                      Review
                    </button>
                  )}
                  {note.adminReviewedBy && (
                    <CheckCircle size={12} className="text-green-500" />
                  )}
                </div>
              </div>

              <p className="text-[12px] text-brutal-ink/80 italic mb-2">"{note.rawText}"</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                {note.workDiscussed && <InfoPill label="Work" value={note.workDiscussed} />}
                {note.assignedTo && <InfoPill label="Assigned" value={note.assignedTo} />}
                {note.deadline && <InfoPill label="Deadline" value={format(new Date(note.deadline), 'dd MMM yyyy')} />}
                {note.currentStatus && <InfoPill label="Status" value={note.currentStatus} />}
                {note.pendingGap && <InfoPill label="Pending" value={note.pendingGap} />}
                {note.followUpAction && <InfoPill label="Follow-up" value={note.followUpAction} />}
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
