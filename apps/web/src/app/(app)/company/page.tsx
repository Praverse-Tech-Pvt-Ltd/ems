'use client';

import { useState } from 'react';
import type React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Employee } from '@/types';
import { Bell, CalendarDays, CheckCircle2, FileText, MessageSquare, Send, Settings, UserPlus } from 'lucide-react';

type AnyRow = Record<string, any>;

export default function CompanyPage() {
  const user = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyBody, setPolicyBody] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [workStart, setWorkStart] = useState('09:30');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [graceMinutes, setGraceMinutes] = useState('0');
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [chatName, setChatName] = useState('');
  const [chatMembers, setChatMembers] = useState<string[]>([]);
  const [activeChannelId, setActiveChannelId] = useState('');
  const [lifecycleEmployee, setLifecycleEmployee] = useState('');
  const [lifecycleTitle, setLifecycleTitle] = useState('');

  const refresh = () => {
    ['policies', 'holidays', 'settings', 'my-tasks', 'admin-tasks', 'chat-channels', 'lifecycle', 'my-lifecycle'].forEach((key) => {
      qc.invalidateQueries({ queryKey: [key] });
    });
  };

  const { data: settings = [] } = useQuery<AnyRow[]>({ queryKey: ['settings'], queryFn: () => apiClient.get('/corporate/settings').then((r) => r.data) });
  const { data: holidays = [] } = useQuery<AnyRow[]>({ queryKey: ['holidays'], queryFn: () => apiClient.get('/corporate/holidays').then((r) => r.data) });
  const { data: policies = [] } = useQuery<AnyRow[]>({ queryKey: ['policies'], queryFn: () => apiClient.get(`/corporate/policies${isAdmin ? '?includeDrafts=true' : ''}`).then((r) => r.data) });
  const { data: myTasks = [] } = useQuery<AnyRow[]>({ queryKey: ['my-tasks'], queryFn: () => apiClient.get('/corporate/tasks/my').then((r) => r.data) });
  const { data: adminTasks = [] } = useQuery<AnyRow[]>({ queryKey: ['admin-tasks'], enabled: isAdmin, queryFn: () => apiClient.get('/corporate/tasks').then((r) => r.data) });
  const { data: channels = [] } = useQuery<AnyRow[]>({ queryKey: ['chat-channels'], queryFn: () => apiClient.get('/corporate/chat/channels').then((r) => r.data) });
  const channel = channels.find((c) => c.id === activeChannelId) ?? channels[0];
  const { data: messages = [] } = useQuery<AnyRow[]>({
    queryKey: ['chat-messages', channel?.id],
    enabled: !!channel?.id,
    queryFn: () => apiClient.get(`/corporate/chat/channels/${channel!.id}/messages`).then((r) => r.data),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-for-company', isAdmin],
    queryFn: () => apiClient.get(isAdmin ? '/employees' : '/employees/colleagues').then((r) => r.data),
  });
  const { data: lifecycle = [] } = useQuery<AnyRow[]>({
    queryKey: [isAdmin ? 'lifecycle' : 'my-lifecycle'],
    queryFn: () => apiClient.get(isAdmin ? '/corporate/lifecycle' : '/corporate/lifecycle/my').then((r) => r.data),
  });
  const { data: documents = [] } = useQuery<AnyRow[]>({
    queryKey: ['documents-review'],
    enabled: isAdmin,
    queryFn: () => apiClient.get('/employees/documents/review').then((r) => r.data),
  });

  const workingHours = settings.find((s) => s.key === 'working_hours')?.value ?? { label: '9:30 AM - 6:00 PM IST' };
  const companyAddress = (settings.find((s) => s.key === 'company_address')?.value as any) ?? {
    full: '413 & 420, Prince Cube, Beside Gangotri Exotica, Laxmipura Char Rasta, Nayaran Garden, 30 Mtr Road, Gotri, Vadodara, Gujarat 390023, India',
  };
  const postPolicy = useMutation({ mutationFn: () => apiClient.post('/corporate/policies', { title: policyTitle, category: 'HR', body: policyBody, status: 'PUBLISHED' }), onSuccess: refresh });
  const ackPolicy = useMutation({ mutationFn: (id: string) => apiClient.post(`/corporate/policies/${id}/acknowledge`), onSuccess: refresh });
  const postHoliday = useMutation({ mutationFn: () => apiClient.post('/corporate/holidays', { date: holidayDate, title: holidayTitle, isPaid: true }), onSuccess: refresh });
  const saveWorkingHours = useMutation({
    mutationFn: () => apiClient.post('/corporate/settings/working_hours', {
      timezone: 'Asia/Kolkata',
      start: workStart,
      end: workEnd,
      graceMinutes: Number(graceMinutes || 0),
      label: `${workStart} - ${workEnd} IST`,
    }),
    onSuccess: refresh,
  });
  const reviewDoc = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) => apiClient.patch(`/employees/documents/${id}/review`, { status, rejectionReason: status === 'REJECTED' ? 'Please re-upload a clearer document.' : undefined }),
    onSuccess: refresh,
  });
  const postTask = useMutation({ mutationFn: () => apiClient.post('/corporate/tasks', { title: taskTitle, employeeIds: selectedEmployees, priority: 'NORMAL' }), onSuccess: refresh });
  const completeTask = useMutation({ mutationFn: (id: string) => apiClient.patch(`/corporate/tasks/my/${id}/complete`), onSuccess: refresh });
  const sendMessage = useMutation({ mutationFn: () => apiClient.post(`/corporate/chat/channels/${channel!.id}/messages`, { body: message }), onSuccess: () => { setMessage(''); refresh(); } });
  const createChat = useMutation({
    mutationFn: () => apiClient.post('/corporate/chat/channels', {
      name: chatName || undefined,
      employeeIds: chatMembers,
    }),
    onSuccess: (res) => {
      setChatName('');
      setChatMembers([]);
      setActiveChannelId(res.data.id);
      refresh();
    },
  });
  const postLifecycle = useMutation({ mutationFn: () => apiClient.post('/corporate/lifecycle', { employeeId: lifecycleEmployee, eventType: 'JOINING', title: lifecycleTitle }), onSuccess: refresh });

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <p className="font-display font-bold text-xs uppercase tracking-[0.35em] text-[#4a4a4a] mb-3">Policies / Tasks / Chat / Holidays</p>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Company<br /><span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>OS</span>
          </h1>
        </div>
        <div className="space-y-3">
          <div className="brutal-border brutal-shadow bg-brutal-ink text-white p-5 min-w-[280px]">
            <p className="font-display font-bold text-[10px] uppercase tracking-[0.25em] text-white/60">Working Hours</p>
            <p className="font-display font-bold text-2xl text-brutal-yellow">{workingHours.label}</p>
            <p className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-white/60">Asia/Kolkata</p>
          </div>
          <div className="brutal-border brutal-shadow bg-brutal-yellow p-4 min-w-[280px]">
            <p className="font-display font-bold text-[10px] uppercase tracking-[0.25em] text-brutal-ink/60 mb-1">Office Address</p>
            <p className="font-display font-bold text-[12px] text-brutal-ink leading-relaxed">
              413 &amp; 420, Prince Cube<br />
              Beside Gangotri Exotica<br />
              Laxmipura Char Rasta, Nayaran Garden<br />
              30 Mtr Road, Gotri<br />
              {companyAddress.city ?? 'Vadodara'}, {companyAddress.state ?? 'Gujarat'} {companyAddress.pincode ?? '390023'}<br />
              {companyAddress.country ?? 'India'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6">
        <section className="space-y-6">
          <Panel title="Task Bar" icon={<Bell size={16} />}>
            <div className="space-y-3">
              {myTasks.slice(0, 5).map((a) => (
                <div key={a.id} className="brutal-border p-3 flex items-center justify-between gap-3 bg-brutal-surface">
                  <div>
                    <p className="font-display font-bold uppercase">{a.task.title}</p>
                    <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{a.status}</p>
                  </div>
                  <button disabled={a.status === 'COMPLETED'} onClick={() => completeTask.mutate(a.id)} className="brutal-btn-primary px-3 py-2 text-[10px] disabled:opacity-40">
                    Complete
                  </button>
                </div>
              ))}
              {myTasks.length === 0 && <Empty text="No assigned tasks." />}
            </div>
          </Panel>

          <Panel title="Organisation Chat" icon={<MessageSquare size={16} />}>
            <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-3 mb-3">
              <div className="brutal-border bg-brutal-surface p-3 space-y-2">
                <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Channels</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {channels.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveChannelId(c.id)}
                      className={`w-full text-left px-2 py-2 brutal-border font-display font-bold text-[11px] uppercase ${
                        channel?.id === c.id ? 'bg-brutal-yellow' : 'bg-brutal-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="brutal-border bg-brutal-surface p-3 space-y-2">
                <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Start Direct / Group Chat</p>
                <input value={chatName} onChange={(e) => setChatName(e.target.value)} placeholder="Chat name optional" className="w-full brutal-border bg-brutal-white px-2 py-2 font-display font-bold text-xs" />
                <select multiple value={chatMembers} onChange={(e) => setChatMembers(Array.from(e.target.selectedOptions).map((o) => o.value))} className="w-full brutal-border bg-brutal-white px-2 py-2 font-display font-bold text-xs h-24">
                  {employees.filter((e) => e.id !== user?.id).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} / {e.employeeCode}</option>)}
                </select>
                <button disabled={chatMembers.length === 0 || createChat.isPending} onClick={() => createChat.mutate()} className="brutal-btn-secondary px-3 py-2 text-[10px] disabled:opacity-40">
                  Create Chat
                </button>
              </div>
            </div>
            <div className="h-[340px] overflow-y-auto brutal-border bg-brutal-surface p-3 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="bg-brutal-white brutal-border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-display font-bold text-xs uppercase">{m.author.firstName} {m.author.lastName}</p>
                    <span className="font-display font-bold text-[9px] uppercase text-[#4a4a4a]">{m.author.role}</span>
                  </div>
                  <p className="font-body text-sm mt-1">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Share an update..." className="flex-1 brutal-border bg-brutal-white px-3 py-2 font-display font-bold" />
              <button disabled={!message || !channel} onClick={() => sendMessage.mutate()} className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-40">
                <Send size={14} /> Send
              </button>
            </div>
            {isAdmin && <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a] mt-2">Admin monitor enabled for company security and compliance.</p>}
          </Panel>
        </section>

        <section className="space-y-6">
          <Panel title="Policies" icon={<FileText size={16} />}>
            {isAdmin && (
              <div className="grid gap-2 mb-4">
                <input value={policyTitle} onChange={(e) => setPolicyTitle(e.target.value)} placeholder="Policy title" className="brutal-border bg-brutal-surface px-3 py-2 font-display font-bold" />
                <textarea value={policyBody} onChange={(e) => setPolicyBody(e.target.value)} placeholder="Policy text" className="brutal-border bg-brutal-surface px-3 py-2 font-body min-h-20" />
                <button disabled={!policyTitle} onClick={() => postPolicy.mutate()} className="brutal-btn-secondary px-3 py-2 text-xs">Publish Policy</button>
              </div>
            )}
            <div className="space-y-2">
              {policies.slice(0, 5).map((p) => {
                const acknowledged = !!p.acknowledgements?.length;
                return (
                  <div key={p.id} className="brutal-border bg-brutal-surface p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display font-bold uppercase text-xs">{p.title}</p>
                      <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{p.category} / {p.status}</p>
                    </div>
                    <button disabled={acknowledged || p.status !== 'PUBLISHED'} onClick={() => ackPolicy.mutate(p.id)} className="brutal-btn-secondary px-3 py-2 text-[10px] disabled:opacity-40">
                      {acknowledged ? 'Acknowledged' : 'Acknowledge'}
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Holiday Calendar" icon={<CalendarDays size={16} />}>
            {isAdmin && (
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-4">
                <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="brutal-border bg-brutal-surface px-2 py-2 font-display font-bold" />
                <input value={holidayTitle} onChange={(e) => setHolidayTitle(e.target.value)} placeholder="Holiday reason" className="brutal-border bg-brutal-surface px-2 py-2 font-display font-bold" />
                <button disabled={!holidayDate || !holidayTitle} onClick={() => postHoliday.mutate()} className="brutal-btn-primary px-3 py-2 text-xs">Mark</button>
              </div>
            )}
            <List rows={holidays.slice(0, 6)} render={(h) => <><b>{new Date(h.date).toLocaleDateString('en-IN')}</b><span>{h.title}</span></>} />
          </Panel>

          {isAdmin && (
            <Panel title="Admin Settings" icon={<Settings size={16} />}>
              <div className="grid grid-cols-3 gap-2">
                <input value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="brutal-border bg-brutal-surface px-2 py-2 font-display font-bold" />
                <input value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="brutal-border bg-brutal-surface px-2 py-2 font-display font-bold" />
                <input value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} placeholder="Grace" className="brutal-border bg-brutal-surface px-2 py-2 font-display font-bold" />
              </div>
              <button onClick={() => saveWorkingHours.mutate()} className="mt-3 brutal-btn-primary px-3 py-2 text-xs">Save Working Hours</button>
            </Panel>
          )}

          {isAdmin && (
            <Panel title="Document Verification" icon={<FileText size={16} />}>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {documents.slice(0, 8).map((doc) => (
                  <div key={doc.id} className="brutal-border bg-brutal-surface p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display font-bold uppercase text-xs">{doc.employee?.firstName} {doc.employee?.lastName} / {doc.docType}</p>
                      <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{doc.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={doc.status === 'VERIFIED'} onClick={() => reviewDoc.mutate({ id: doc.id, status: 'VERIFIED' })} className="brutal-btn-secondary px-2 py-1 text-[10px] disabled:opacity-40">Verify</button>
                      <button disabled={doc.status === 'REJECTED'} onClick={() => reviewDoc.mutate({ id: doc.id, status: 'REJECTED' })} className="bg-brutal-red text-white brutal-border px-2 py-1 font-display font-bold text-[10px] uppercase disabled:opacity-40">Reject</button>
                    </div>
                  </div>
                ))}
                {!documents.length && <Empty text="No documents submitted." />}
              </div>
            </Panel>
          )}

          {isAdmin && (
            <Panel title="Admin Assignment" icon={<CheckCircle2 size={16} />}>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold mb-2" />
              <select multiple value={selectedEmployees} onChange={(e) => setSelectedEmployees(Array.from(e.target.selectedOptions).map((o) => o.value))} className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold h-28">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} / {e.employeeCode}</option>)}
              </select>
              <button disabled={!taskTitle || selectedEmployees.length === 0} onClick={() => postTask.mutate()} className="mt-3 brutal-btn-primary px-4 py-2 text-xs">Assign Task + Notify</button>
              <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a] mt-3">{adminTasks.length} tasks monitored by admin.</p>
            </Panel>
          )}

          <Panel title="Employee Lifecycle" icon={<UserPlus size={16} />}>
            {isAdmin && (
              <div className="grid gap-2 mb-4">
                <select value={lifecycleEmployee} onChange={(e) => setLifecycleEmployee(e.target.value)} className="brutal-border bg-brutal-surface px-3 py-2 font-display font-bold">
                  <option value="">Select employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
                <input value={lifecycleTitle} onChange={(e) => setLifecycleTitle(e.target.value)} placeholder="Lifecycle item e.g. Probation review" className="brutal-border bg-brutal-surface px-3 py-2 font-display font-bold" />
                <button disabled={!lifecycleEmployee || !lifecycleTitle} onClick={() => postLifecycle.mutate()} className="brutal-btn-secondary px-3 py-2 text-xs">Add Lifecycle Item</button>
              </div>
            )}
            <List rows={lifecycle.slice(0, 5)} render={(l) => <><b>{l.title}</b><span>{l.eventType} / {l.status}</span></>} />
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-brutal-white brutal-border brutal-shadow">
      <div className="px-5 py-3 brutal-border-b bg-brutal-ink text-white flex items-center gap-2 font-display font-bold text-sm uppercase tracking-[0.18em]">
        {icon} {title}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="font-display font-bold uppercase text-sm text-[#4a4a4a] text-center py-6">{text}</p>;
}

function List({ rows, render }: { rows: AnyRow[]; render: (row: AnyRow) => React.ReactNode }) {
  if (!rows.length) return <Empty text="Nothing here yet." />;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="brutal-border bg-brutal-surface p-3 flex justify-between gap-3 font-display text-xs uppercase">
          {render(row)}
        </div>
      ))}
    </div>
  );
}
