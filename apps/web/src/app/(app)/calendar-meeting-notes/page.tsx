'use client';

import { useState, useEffect } from 'react';
import { calendarService, meetingNotesService } from '@/lib/api/management';
import { clientsService } from '@/lib/api/clients';
import { employeesService } from '@/lib/api/employees';
import { useAuthStore } from '@/store/auth.store';
import { useNotifications } from '@/hooks/useNotifications';
import { useQueryClient } from '@tanstack/react-query';

const EVENT_TYPE_COLOR: Record<string, string> = {
  INTERNAL: 'border-l-primary bg-primary/5',
  CLIENT: 'border-l-tertiary bg-tertiary/5',
  COMPLIANCE: 'border-l-error bg-error/5',
  HOLIDAY: 'border-l-tertiary bg-tertiary/5',
  OTHER: 'border-l-on-surface-variant bg-surface-container-low',
};

export default function CalendarMeetingNotesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const { latest: liveAssignment, dismiss: dismissLiveAssignment } = useNotifications();

  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [myCompanies, setMyCompanies] = useState<any[]>([]);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [noteForm, setNoteForm] = useState({ rawText: '', meetingDate: new Date().toISOString().slice(0, 10) });
  const [assignForm, setAssignForm] = useState({
    companyId: '',
    employeeId: '',
    visitDate: new Date().toISOString().slice(0, 10),
    purpose: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [assignNote, setAssignNote] = useState('');

  const load = async () => {
    try {
      const [upcoming, notesData, cntd, companiesRes, employeesRes] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ['calendar-upcoming'], queryFn: () => calendarService.upcoming(30) }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['calendar-notes'], queryFn: () => meetingNotesService.list({ limit: 10 }) }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['calendar-audit-countdowns'], queryFn: () => calendarService.auditCountdowns() }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['calendar-companies'], queryFn: () => clientsService.list() }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['calendar-employees'], queryFn: () => employeesService.list() }).catch(() => []),
      ]);
      setEvents(Array.isArray(upcoming) ? upcoming : upcoming?.data ?? []);
      setNotes(Array.isArray(notesData) ? notesData : notesData?.data ?? []);
      setCountdowns(Array.isArray(cntd) ? cntd : cntd?.data ?? []);
      const companiesArr = Array.isArray(companiesRes) ? companiesRes : companiesRes?.data ?? [];
      setAllCompanies(companiesArr);
      setMyCompanies(companiesArr.filter((c: any) =>
        c.responsibleEmployee?.id === user?.id || c.responsibleEmployeeId === user?.id,
      ));
      const employeesArr = Array.isArray(employeesRes) ? employeesRes : employeesRes?.data ?? [];
      setEmployees(employeesArr.filter((e: any) => e.id !== user?.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAssignVisit = async () => {
    if (!assignForm.companyId || !assignForm.employeeId || !assignForm.visitDate) return;
    setSubmitting(true);
    try {
      const company = allCompanies.find((c: any) => c.id === assignForm.companyId);
      const employee = employees.find((e: any) => e.id === assignForm.employeeId);
      await calendarService.create({
        title: `Visit: ${company?.name ?? 'Client'}${employee ? ` — ${employee.firstName}` : ''}`,
        description: assignForm.purpose || undefined,
        eventType: 'CLIENT_VISIT',
        startDate: new Date(assignForm.visitDate).toISOString(),
        allDay: true,
        companyId: assignForm.companyId,
        assignedTo: assignForm.employeeId,
      });
      setShowAssign(false);
      setAssignNote(`Visit assigned to ${employee?.firstName ?? 'employee'} — they've been notified and it's on their calendar.`);
      window.setTimeout(() => setAssignNote(''), 5000);
      setAssignForm({ companyId: '', employeeId: '', visitDate: new Date().toISOString().slice(0, 10), purpose: '' });
      await load();
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteForm.rawText.trim()) return;
    setSubmitting(true);
    try {
      await meetingNotesService.create(noteForm);
      setShowAddNote(false);
      setNoteForm({ rawText: '', meetingDate: new Date().toISOString().slice(0, 10) });
      await load();
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  // Build week strip for current week
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dayEvents = events.filter(e => new Date(e.startDate ?? e.date).getDate() === d.getDate());
    return { date: d.getDate(), month: d.getMonth(), day: d.toLocaleDateString('en-US', { weekday: 'short' }), events: dayEvents.length };
  });

  const todayEvents = events.filter(e => new Date(e.startDate ?? e.date).getDate() === selectedDay);

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          CALENDAR
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Calendar & Meetings</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Calendar & Meetings</h2>
            <p className="text-on-surface-variant mt-xs">Company events, meeting notes, and audit countdowns.</p>
          </div>
          <div className="flex gap-sm shrink-0">
            {isAdmin && (
              <button onClick={() => { setShowAssign(!showAssign); setShowAddNote(false); }}
                className="flex items-center gap-xs text-label-caps font-label-caps bg-tertiary text-on-tertiary px-4 py-2 rounded-full hover:opacity-90">
                <span className="material-symbols-outlined text-[16px]">{showAssign ? 'close' : 'person_add'}</span>
                {showAssign ? 'Cancel' : 'Assign Visit'}
              </button>
            )}
            <button onClick={() => { setShowAddNote(!showAddNote); setShowAssign(false); }}
              className="flex min-h-11 items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90">
              <span className="material-symbols-outlined text-[16px]">{showAddNote ? 'close' : 'add'}</span>
              {showAddNote ? 'Cancel' : 'Add Note'}
            </button>
          </div>
        </div>
      </div>

      {liveAssignment && (
        <div className="rounded-xl px-4 py-3 text-sm bg-primary/10 text-primary border border-primary/20 flex items-center justify-between gap-sm">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            <span>
              <strong>{liveAssignment.notification.title}</strong> — {liveAssignment.notification.body}
            </span>
          </div>
          <button onClick={() => { dismissLiveAssignment(); load(); }} className="text-primary hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {assignNote && (
        <div className="rounded-xl px-4 py-3 text-sm bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          {assignNote}
        </div>
      )}

      {/* Assign visit form */}
      {showAssign && (
        <div className="glass-card rounded-2xl p-lg border border-tertiary/30">
          <p className="font-label-caps text-label-caps text-tertiary tracking-widest mb-md">ASSIGN COMPANY VISIT</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-sm mb-sm">
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">COMPANY</label>
              <select value={assignForm.companyId}
                onChange={e => setAssignForm(p => ({ ...p, companyId: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-tertiary focus:outline-none">
                <option value="">Select a company…</option>
                {allCompanies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">ASSIGN TO</label>
              <select value={assignForm.employeeId}
                onChange={e => setAssignForm(p => ({ ...p, employeeId: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-tertiary focus:outline-none">
                <option value="">Select team member…</option>
                {employees.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.designation ? ` — ${e.designation}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">VISIT DATE</label>
              <input type="date" value={assignForm.visitDate}
                onChange={e => setAssignForm(p => ({ ...p, visitDate: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-tertiary focus:outline-none" />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">PURPOSE / NOTES</label>
              <input type="text" value={assignForm.purpose}
                onChange={e => setAssignForm(p => ({ ...p, purpose: e.target.value }))}
                placeholder="e.g. CAPA follow-up visit"
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-tertiary focus:outline-none" />
            </div>
          </div>
          <button onClick={handleAssignVisit} disabled={submitting || !assignForm.companyId || !assignForm.employeeId}
            className="bg-tertiary text-on-tertiary font-label-caps text-label-caps px-lg py-2 rounded-full hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Assigning...' : 'Assign & Notify'}
          </button>
          <p className="text-[11px] text-on-surface-variant mt-sm">
            This adds the visit to your calendar, syncs it to the assignee&apos;s calendar, and sends them a live notification.
          </p>
        </div>
      )}

      {/* Add note form */}
      {showAddNote && (
        <div className="glass-card rounded-2xl p-lg border border-primary/30">
          <p className="font-label-caps text-label-caps text-primary tracking-widest mb-md">NEW MEETING NOTE</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-sm mb-sm">
            <textarea
              value={noteForm.rawText}
              onChange={e => setNoteForm(p => ({ ...p, rawText: e.target.value }))}
              placeholder="Describe what happened in the meeting..."
              rows={3}
              className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">MEETING DATE</label>
              <input type="date" value={noteForm.meetingDate}
                onChange={e => setNoteForm(p => ({ ...p, meetingDate: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
          </div>
          <button onClick={handleAddNote} disabled={submitting}
            className="bg-primary text-on-primary font-label-caps text-label-caps px-lg py-2 rounded-full hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save Meeting Note'}
          </button>
        </div>
      )}

      {/* Week strip */}
      <div>
        <div className="flex items-center justify-between mb-sm">
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
            {today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} — WEEK VIEW
          </p>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-sm">
          {weekDays.map(w => (
            <button key={`${w.day}-${w.date}`} onClick={() => setSelectedDay(w.date)}
              className={`glass-card rounded-xl p-1 sm:p-sm min-h-[44px] min-w-11 flex flex-col items-center justify-center gap-xs border transition-all ${selectedDay === w.date ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/30'}`}>
              <span className="font-label-caps text-[10px] text-on-surface-variant">{w.day}</span>
              <span className={`font-black text-lg ${selectedDay === w.date ? 'text-primary' : 'text-on-surface'}`}>{w.date}</span>
              {w.events > 0 ? (
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(w.events, 3) }).map((_, i) => (
                    <div key={i} className={`w-1 h-1 rounded-full ${selectedDay === w.date ? 'bg-primary' : 'bg-on-surface-variant/40'}`} />
                  ))}
                </div>
              ) : <div className="h-1" />}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda + countdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-lg">
        {/* Events for selected day */}
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">
            {loading ? 'LOADING...' : todayEvents.length > 0 ? `${todayEvents.length} EVENTS — DAY ${selectedDay}` : `NO EVENTS — DAY ${selectedDay}`}
          </p>
          {loading ? (
            <div className="flex flex-col gap-sm">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
            </div>
          ) : todayEvents.length === 0 ? (
            <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
              No events for this day.
            </div>
          ) : (
            <div className="relative flex flex-col gap-sm">
              <div className="absolute left-[3.75rem] top-0 bottom-0 w-px bg-outline-variant/30" />
              {todayEvents.map((ev, i) => {
                const t = ev.startDate ?? ev.date;
                return (
                  <div key={ev.id ?? i} className="grid grid-cols-[60px_1fr] gap-sm items-start">
                    <div className="text-right">
                      <p className="font-semibold text-on-surface text-xs">
                        {t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                      </p>
                    </div>
                    <div className={`border-l-4 rounded-r-xl px-sm py-2 ${EVENT_TYPE_COLOR[ev.eventType ?? ev.type ?? 'OTHER']}`}>
                      <div className="flex items-start justify-between gap-sm">
                        <p className="font-semibold text-on-surface text-sm">{ev.title}</p>
                        <span className="text-[9px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30 shrink-0">
                          {ev.eventType ?? ev.type ?? 'EVENT'}
                        </span>
                      </div>
                      {ev.description && <p className="text-body-sm text-on-surface-variant mt-0.5">{ev.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit countdowns */}
        <div className="flex flex-col gap-sm">
          <div className="glass-card rounded-2xl p-md border border-outline-variant/30">
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-md">AUDIT COUNTDOWNS</p>
            {loading ? (
              <div className="flex flex-col gap-sm">
                {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-surface-container-high animate-pulse" />)}
              </div>
            ) : countdowns.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant text-center">No upcoming audits.</p>
            ) : (
              <div className="flex flex-col gap-sm">
                {countdowns.slice(0, 4).map((a: any, i) => {
                  const days = a.daysLeft ?? a.days ?? 0;
                  return (
                    <div key={i} className="flex items-center gap-sm">
                      <div className={`text-2xl font-black w-14 text-center ${days <= 14 ? 'text-error' : days <= 30 ? 'text-primary' : 'text-on-surface-variant'}`}>{days}</div>
                      <div className="flex-1 min-w-0 border-l border-outline-variant/30 pl-sm">
                        <p className="font-semibold text-on-surface text-sm truncate">{a.title ?? a.label}</p>
                        <p className="text-[10px] text-on-surface-variant">{days} days left</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* My Assigned Companies */}
      {myCompanies.length > 0 && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">MY ASSIGNED COMPANIES</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm">
            {myCompanies.map((c: any) => {
              const statusColor: Record<string, string> = {
                ACTIVE:  'bg-emerald-50 text-emerald-700 border-emerald-200',
                DELAYED: 'bg-amber-50 text-amber-700 border-amber-200',
                AT_RISK: 'bg-rose-50 text-rose-700 border-rose-200',
                LOST:    'bg-slate-100 text-slate-600 border-slate-200',
                DORMANT: 'bg-slate-50 text-slate-500 border-slate-200',
              };
              return (
                <div key={c.id} className="glass-card rounded-xl border border-outline-variant/30 p-md flex flex-col gap-xs hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                      <p className="font-semibold text-on-surface text-sm leading-snug line-clamp-1">{c.name}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor[c.businessStatus] ?? 'bg-surface-container text-on-surface-variant border-outline-variant/30'}`}>
                      {c.businessStatus}
                    </span>
                  </div>
                  {c.currentStage && (
                    <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2">{c.currentStage}</p>
                  )}
                  <div className="flex items-center gap-xs border-t border-outline-variant/20 pt-xs mt-xs">
                    <span className="material-symbols-outlined text-[12px] text-on-surface-variant">location_on</span>
                    <span className="text-[10px] text-on-surface-variant">{c.industry ?? 'Pharma'} · {c.criticality} criticality</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meeting notes */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">MEETING NOTES</p>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
            {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-surface-container-high animate-pulse" />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
            No meeting notes yet. Add your first note above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
            {notes.map(note => (
              <div key={note.id} className="glass-card rounded-2xl p-md border border-outline-variant/30 flex flex-col gap-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-sm">
                  <h4 className="font-semibold text-on-surface text-sm leading-snug line-clamp-1">
                    {note.meetingDate ? new Date(note.meetingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Meeting Note'}
                  </h4>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${note.status === 'REVIEWED' || note.status === 'APPROVED' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                    {note.status ?? 'DRAFT'}
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed line-clamp-3">{note.rawText ?? note.content}</p>
                {note.company && (
                  <div className="flex items-center gap-xs border-t border-outline-variant/20 pt-sm">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">domain</span>
                    <span className="text-[10px] text-on-surface-variant">{note.company.name}</span>
                  </div>
                )}
                {note.author && (
                  <div className="flex items-center justify-between border-t border-outline-variant/20 pt-sm">
                    <p className="text-[10px] text-on-surface-variant">{note.author.firstName} {note.author.lastName}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
