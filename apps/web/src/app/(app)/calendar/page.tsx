'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Plus, AlertTriangle, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';

const EVENT_COLORS: Record<string, string> = {
  AUDIT: 'bg-red-500',
  CLIENT_VISIT: 'bg-blue-500',
  INTERNAL_MEETING: 'bg-green-500',
  DOCUMENT_DEADLINE: 'bg-orange-500',
  FOLLOW_UP: 'bg-yellow-400',
  TASK_DEADLINE: 'bg-purple-500',
  OWNER_MEETING: 'bg-brutal-ink',
  RECURRING_REVIEW: 'bg-teal-500',
  AI_SUGGESTED: 'bg-pink-400',
};

const EVENT_LABELS: Record<string, string> = {
  AUDIT: 'Audit',
  CLIENT_VISIT: 'Client Visit',
  INTERNAL_MEETING: 'Internal Meeting',
  DOCUMENT_DEADLINE: 'Doc Deadline',
  FOLLOW_UP: 'Follow Up',
  TASK_DEADLINE: 'Task Deadline',
  OWNER_MEETING: 'Owner Meeting',
  RECURRING_REVIEW: 'Review',
  AI_SUGGESTED: 'AI Suggested',
};

type NewEvent = {
  title: string; eventType: string; startDate: string; endDate?: string;
  allDay: boolean; companyId?: string; description?: string; reminderDays?: number;
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<NewEvent>>({ allDay: true, eventType: 'INTERNAL_MEETING' });
  const qc = useQueryClient();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const from = format(monthStart, 'yyyy-MM-dd');
  const to = format(monthEnd, 'yyyy-MM-dd');

  const { data: events = [] } = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => apiClient.get('/company-calendar', { params: { from, to } }).then(r => r.data),
  });

  const { data: auditCountdowns = [] } = useQuery({
    queryKey: ['audit-countdowns'],
    queryFn: () => apiClient.get('/company-calendar/audit-countdowns').then(r => r.data),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['client-companies-list'],
    queryFn: () => apiClient.get('/client-companies').then(r => r.data),
  });

  const { mutate: createEvent, isPending } = useMutation({
    mutationFn: (dto: NewEvent) => apiClient.post('/company-calendar', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['audit-countdowns'] });
      setShowForm(false);
      setNewEvent({ allDay: true, eventType: 'INTERNAL_MEETING' });
    },
  });

  const eventsOnDay = (day: Date) => events.filter((e: any) => isSameDay(new Date(e.startDate), day));

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setNewEvent(prev => ({ ...prev, startDate: format(day, 'yyyy-MM-dd') }));
    setShowForm(true);
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7;
  const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Company Calendar"
        subtitle="Audits, visits, deadlines and follow-ups in one view"
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Add Event
          </Button>
        }
      />

      {/* Audit countdowns */}
      {auditCountdowns.length > 0 && (
        <div className="mb-5">
          <h3 className="font-display font-bold text-[11px] tracking-widest uppercase mb-2 text-brutal-ink/60">AUDIT COUNTDOWNS</h3>
          <div className="flex flex-wrap gap-2">
            {auditCountdowns.slice(0, 6).map((e: any) => (
              <div key={e.id} className={`flex items-center gap-2 px-3 py-2 border-2 text-sm font-display font-bold ${
                e.daysUntil <= 7 ? 'border-brutal-red bg-red-50 text-brutal-red' :
                e.daysUntil <= 30 ? 'border-orange-400 bg-orange-50 text-orange-700' :
                'border-brutal-ink/30 bg-white text-brutal-ink'
              }`}>
                <AlertTriangle size={12} />
                <span>{e.company?.name ?? e.title}</span>
                <span className="ml-1">{e.daysUntil === 0 ? 'TODAY' : `${e.daysUntil}d`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="brutal-border bg-white">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 brutal-border-b bg-brutal-yellow">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="brutal-border w-8 h-8 grid place-items-center hover:bg-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-display font-bold text-lg">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="brutal-border w-8 h-8 grid place-items-center hover:bg-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 brutal-border-b">
          {dayNames.map(d => (
            <div key={d} className="py-2 text-center font-display font-bold text-[10px] tracking-widest text-brutal-ink/50 brutal-border-r last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {paddingDays.map((_, i) => <div key={`pad-${i}`} className="brutal-border-r brutal-border-b min-h-[80px] bg-brutal-surface/40" />)}
          {days.map(day => {
            const dayEvents = eventsOnDay(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`brutal-border-r brutal-border-b min-h-[80px] p-1 cursor-pointer transition-colors ${
                  isToday(day) ? 'bg-brutal-yellow/30' :
                  isSelected ? 'bg-brutal-blue/10' :
                  'hover:bg-brutal-surface'
                }`}
              >
                <div className={`text-right text-[11px] font-display font-bold mb-1 ${isToday(day) ? 'text-brutal-red' : 'text-brutal-ink/60'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e: any) => (
                    <div
                      key={e.id}
                      className={`${EVENT_COLORS[e.eventType] ?? 'bg-gray-400'} text-white text-[9px] font-display font-bold px-1 py-0.5 truncate`}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] text-brutal-ink/50 font-display">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(EVENT_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={`w-3 h-3 ${EVENT_COLORS[key] ?? 'bg-gray-400'}`} />
            <span className="text-[10px] font-display text-brutal-ink/60">{label}</span>
          </div>
        ))}
      </div>

      {/* Add Event modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
          <div className="bg-white brutal-border w-full max-w-md max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-4 brutal-border-b bg-brutal-yellow">
              <h3 className="font-display font-bold text-[13px] tracking-widest uppercase">Add Calendar Event</h3>
              <button onClick={() => setShowForm(false)} className="brutal-border w-7 h-7 grid place-items-center hover:bg-white">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Title *">
                <input className="w-full brutal-border p-2 text-sm font-display outline-none" value={newEvent.title ?? ''} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
              </Field>
              <Field label="Event Type *">
                <select className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" value={newEvent.eventType} onChange={e => setNewEvent(p => ({ ...p, eventType: e.target.value }))}>
                  {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Date *">
                <input type="date" className="w-full brutal-border p-2 text-sm font-display outline-none" value={newEvent.startDate ?? ''} onChange={e => setNewEvent(p => ({ ...p, startDate: e.target.value }))} />
              </Field>
              <Field label="End Date">
                <input type="date" className="w-full brutal-border p-2 text-sm font-display outline-none" value={newEvent.endDate ?? ''} onChange={e => setNewEvent(p => ({ ...p, endDate: e.target.value }))} />
              </Field>
              <Field label="Company (optional)">
                <select className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" value={newEvent.companyId ?? ''} onChange={e => setNewEvent(p => ({ ...p, companyId: e.target.value || undefined }))}>
                  <option value="">None</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <textarea className="w-full brutal-border p-2 text-sm font-display outline-none resize-none" rows={2} value={newEvent.description ?? ''} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} />
              </Field>
              <Field label="Reminder (days before)">
                <input type="number" className="w-full brutal-border p-2 text-sm font-display outline-none" value={newEvent.reminderDays ?? ''} onChange={e => setNewEvent(p => ({ ...p, reminderDays: e.target.value ? parseInt(e.target.value) : undefined }))} />
              </Field>
              <Button
                className="w-full"
                disabled={!newEvent.title || !newEvent.startDate || isPending}
                onClick={() => {
                  if (newEvent.title && newEvent.startDate) {
                    createEvent(newEvent as NewEvent);
                  }
                }}
              >
                {isPending ? 'Saving…' : 'Save Event'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
