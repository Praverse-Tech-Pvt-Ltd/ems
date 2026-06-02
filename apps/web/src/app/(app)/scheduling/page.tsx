'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import { Calendar, Plus, Save, Trash2, Users, Building, AlertCircle, CheckCircle2, XCircle, X } from 'lucide-react';

interface ScheduleCell {
  company: string;
  memberEmail: string;
  days: string;
}

interface ScheduleData {
  companies: string[];
  members: { name: string; email: string }[];
  cells: ScheduleCell[];
}

const DEFAULT_SCHEDULE: ScheduleData = {
  companies: [
    'Bhageria Industries Limited',
    'Unimark Remedies Limited',
    'Almon Healthcare Pvt Ltd',
    'Bills Biotech Pvt Ltd',
    'Vemed Pharmaceuticals Pvt Ltd',
    'West Coast Pharma',
    'Romano Drugs',
    'Cohesion Biotec',
    'Peak Lifeline',
    'Siddharth Interchem'
  ],
  members: [
    { name: 'Dilip Pathak', email: 'dilip.pathak@nexgenpharmasolutions.com' },
    { name: 'Shifa Mobh', email: 'shifa.mobh@nexgenpharmasolutions.com' },
    { name: 'Chandni Jha', email: 'chandni.jha@nexgenpharmasolutions.com' },
    { name: 'Ashwani Shrivastav', email: 'ashwani@nexgenpharmasolutions.com' }
  ],
  cells: [
    { company: 'Bhageria Industries Limited', memberEmail: 'dilip.pathak@nexgenpharmasolutions.com', days: '10' },
    { company: 'Bhageria Industries Limited', memberEmail: 'ashwani@nexgenpharmasolutions.com', days: '23' },
    { company: 'Unimark Remedies Limited', memberEmail: 'dilip.pathak@nexgenpharmasolutions.com', days: '11' },
    { company: 'Unimark Remedies Limited', memberEmail: 'chandni.jha@nexgenpharmasolutions.com', days: '15,24,25' },
    { company: 'Almon Healthcare Pvt Ltd', memberEmail: 'shifa.mobh@nexgenpharmasolutions.com', days: '5,16' },
    { company: 'Almon Healthcare Pvt Ltd', memberEmail: 'chandni.jha@nexgenpharmasolutions.com', days: '5,16' },
    { company: 'Almon Healthcare Pvt Ltd', memberEmail: 'ashwani@nexgenpharmasolutions.com', days: '24' },
    { company: 'Bills Biotech Pvt Ltd', memberEmail: 'shifa.mobh@nexgenpharmasolutions.com', days: '5' },
    { company: 'Bills Biotech Pvt Ltd', memberEmail: 'ashwani@nexgenpharmasolutions.com', days: '25' },
    { company: 'Vemed Pharmaceuticals Pvt Ltd', memberEmail: 'dilip.pathak@nexgenpharmasolutions.com', days: '3,9' },
    { company: 'Vemed Pharmaceuticals Pvt Ltd', memberEmail: 'chandni.jha@nexgenpharmasolutions.com', days: '18,3,9,18' },
    { company: 'Vemed Pharmaceuticals Pvt Ltd', memberEmail: 'ashwani@nexgenpharmasolutions.com', days: '22' },
    { company: 'West Coast Pharma', memberEmail: 'dilip.pathak@nexgenpharmasolutions.com', days: '2,4,8,12,15-20' },
    { company: 'West Coast Pharma', memberEmail: 'ashwani@nexgenpharmasolutions.com', days: '6' },
    { company: 'Romano Drugs', memberEmail: 'chandni.jha@nexgenpharmasolutions.com', days: '8' },
    { company: 'Peak Lifeline', memberEmail: 'shifa.mobh@nexgenpharmasolutions.com', days: '8,15' },
    { company: 'Siddharth Interchem', memberEmail: 'ashwani@nexgenpharmasolutions.com', days: '22' }
  ]
};

const MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string };
type ConfirmDialog = { message: string; onConfirm: () => void } | null;

export default function ClientSchedulingPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [schedule, setSchedule] = useState<ScheduleData>(DEFAULT_SCHEDULE);
  const [newCompany, setNewCompany] = useState('');
  const [selectedMemberEmail, setSelectedMemberEmail] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const showToast = (type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  // Fetch corporate settings
  const { data: settings = [], isLoading } = useQuery<any[]>({
    queryKey: ['corporate-settings'],
    queryFn: () => apiClient.get('/corporate/settings').then(r => r.data).catch(() => []),
  });

  // Fetch all employees to select new team members
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => apiClient.get('/employees').then(r => r.data).catch(() => []),
  });

  useEffect(() => {
    const key = `client_scheduling_matrix_${selectedMonth.year}_${selectedMonth.month}`;
    const monthlySetting = settings.find(s => s.key === key);
    if (monthlySetting && monthlySetting.value) {
      setSchedule(monthlySetting.value as ScheduleData);
    } else {
      const generalSetting = settings.find(s => s.key === 'client_scheduling_matrix');
      const companies = generalSetting?.value?.companies || DEFAULT_SCHEDULE.companies;
      const members = generalSetting?.value?.members || DEFAULT_SCHEDULE.members;
      setSchedule({
        companies,
        members,
        cells: [],
      });
    }
  }, [settings, selectedMonth]);

  const saveMutation = useMutation({
    mutationFn: async (data: ScheduleData) => {
      const key = `client_scheduling_matrix_${selectedMonth.year}_${selectedMonth.month}`;
      await apiClient.post(`/corporate/settings/${key}`, { value: data });
      // Also update base/default companies & members template
      await apiClient.post('/corporate/settings/client_scheduling_matrix', {
        value: {
          companies: data.companies,
          members: data.members,
          cells: data.cells,
        }
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corporate-settings'] });
      showToast('success', `Board locked in — ${MONTH_NAMES[selectedMonth.month]} ${selectedMonth.year} schedule is live.`);
    },
    onError: () => {
      showToast('error', 'Board save failed. Check your connection and try again.');
    }
  });

  const handleCellChange = (company: string, memberEmail: string, days: string) => {
    setSchedule(prev => {
      const filteredCells = prev.cells.filter(c => !(c.company === company && c.memberEmail === memberEmail));
      if (days.trim()) {
        filteredCells.push({ company, memberEmail, days: days.trim() });
      }
      return { ...prev, cells: filteredCells };
    });
  };

  const getCellDays = (company: string, memberEmail: string) => {
    const cell = schedule.cells.find(c => c.company === company && c.memberEmail === memberEmail);
    return cell ? cell.days : '';
  };

  const handleAddCompany = () => {
    if (!newCompany.trim()) return;
    if (schedule.companies.includes(newCompany.trim())) {
      showToast('info', 'That company is already on the board.');
      return;
    }
    setSchedule(prev => ({
      ...prev,
      companies: [...prev.companies, newCompany.trim()]
    }));
    setNewCompany('');
  };

  const handleRemoveCompany = (company: string) => {
    showConfirm(`Remove "${company}" from the board?`, () => {
      setSchedule(prev => ({
        ...prev,
        companies: prev.companies.filter(c => c !== company),
        cells: prev.cells.filter(c => c.company !== company)
      }));
    });
  };

  const handleAddMember = () => {
    if (!selectedMemberEmail) return;
    const emp = employees.find(e => e.email === selectedMemberEmail);
    if (!emp) return;
    if (schedule.members.some(m => m.email === emp.email)) {
      showToast('info', 'That team member is already on the board.');
      return;
    }
    setSchedule(prev => ({
      ...prev,
      members: [...prev.members, { name: `${emp.firstName} ${emp.lastName}`, email: emp.email }]
    }));
    setSelectedMemberEmail('');
  };

  const handleRemoveMember = (email: string) => {
    showConfirm('Remove this team member from the board?', () => {
      setSchedule(prev => ({
        ...prev,
        members: prev.members.filter(m => m.email !== email),
        cells: prev.cells.filter(c => c.memberEmail !== email)
      }));
    });
  };

  const handleSaveBoard = () => {
    saveMutation.mutate(schedule);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-fade-up">
        <div className="h-12 w-64 skeleton" />
        <div className="h-96 w-full skeleton brutal-border" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-up">
      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 brutal-border brutal-shadow font-display font-bold text-[12px] tracking-wide max-w-[340px] animate-fade-up ${t.type === 'success' ? 'bg-brutal-yellow' : t.type === 'error' ? 'bg-brutal-red text-white' : 'bg-brutal-cream'}`}>
            {t.type === 'success' && <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            {t.type === 'error' && <XCircle size={16} className="shrink-0 mt-0.5" />}
            {t.type === 'info' && <AlertCircle size={16} className="shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brutal-ink/40 backdrop-blur-sm">
          <div className="bg-brutal-cream brutal-border brutal-shadow p-6 max-w-sm w-full mx-4">
            <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60 mb-3">— CONFIRM ACTION</div>
            <p className="font-display font-bold text-[15px] leading-snug mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="brutal-btn-primary flex-1 py-2.5 text-[12px]"
              >
                YES, REMOVE
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 text-[12px] brutal-border font-display font-bold hover:bg-brutal-yellow transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— ADMIN TOOLS / 12</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            CLIENT <span className="inline-block bg-brutal-yellow px-2">SCHEDULING</span><span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
            ASSIGN AUDIT DAYS · QA TEAM MATRIX BOARD
          </div>
        </div>

        <button
          onClick={handleSaveBoard}
          disabled={saveMutation.isPending}
          className="brutal-btn-primary px-6 py-3.5 text-[13px] flex items-center gap-2"
        >
          <Save size={16} />
          {saveMutation.isPending ? 'SAVING BOARD…' : 'SAVE BOARD'}
        </button>
      </div>

      {/* Month/Year selector */}
      <div className="flex items-center gap-3 bg-brutal-cream p-4 brutal-border brutal-shadow max-w-fit">
        <button
          onClick={() => {
            setSelectedMonth(prev => {
              if (prev.month === 0) return { year: prev.year - 1, month: 11 };
              return { year: prev.year, month: prev.month - 1 };
            });
          }}
          className="w-9 h-9 grid place-items-center border-2 border-brutal-ink bg-brutal-surface hover:bg-brutal-yellow hover:scale-105 transition-all brutal-shadow-sm font-bold"
        >
          ←
        </button>
        <div className="px-5 py-2 bg-brutal-ink text-white font-display font-extrabold text-[12px] tracking-[0.2em] border-2 border-brutal-ink min-w-[200px] text-center uppercase">
          {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}
        </div>
        <button
          onClick={() => {
            setSelectedMonth(prev => {
              if (prev.month === 11) return { year: prev.year + 1, month: 0 };
              return { year: prev.year, month: prev.month + 1 };
            });
          }}
          className="w-9 h-9 grid place-items-center border-2 border-brutal-ink bg-brutal-surface hover:bg-brutal-yellow hover:scale-105 transition-all brutal-shadow-sm font-bold"
        >
          →
        </button>
      </div>

      {/* Control panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Company */}
        <div className="brutal-border brutal-shadow bg-brutal-cream p-5">
          <h2 className="font-display font-bold text-[12px] tracking-widest uppercase flex items-center gap-2 mb-3">
            <Building size={14} className="text-brutal-blue" /> Add Client Company
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCompany}
              onChange={e => setNewCompany(e.target.value)}
              placeholder="e.g. Bhageria Industries Limited"
              className="flex-1 brutal-border bg-brutal-surface px-3 py-2.5 font-display font-bold text-[12px] focus:outline-none"
            />
            <button
              onClick={handleAddCompany}
              className="brutal-btn-primary px-4 py-2.5 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> ADD
            </button>
          </div>
        </div>

        {/* Add Team Member */}
        <div className="brutal-border brutal-shadow bg-brutal-cream p-5">
          <h2 className="font-display font-bold text-[12px] tracking-widest uppercase flex items-center gap-2 mb-3">
            <Users size={14} className="text-brutal-yellow" /> Add QA Team Member
          </h2>
          <div className="flex gap-2">
            <select
              value={selectedMemberEmail}
              onChange={e => setSelectedMemberEmail(e.target.value)}
              className="flex-1 brutal-border bg-brutal-surface px-3 py-2.5 font-display font-bold text-[12px] focus:outline-none"
            >
              <option value="">SELECT EMPLOYEE…</option>
              {employees
                .filter(e => !schedule.members.some(m => m.email === e.email))
                .map(e => (
                  <option key={e.email} value={e.email}>
                    {e.firstName} {e.lastName} ({e.department?.name ?? 'No Dept'})
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddMember}
              className="brutal-btn-primary px-4 py-2.5 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> ADD
            </button>
          </div>
        </div>
      </div>

      {/* Information Banner */}
      <div className="flex items-start gap-3 p-4 bg-brutal-blue/10 border-2 border-brutal-blue text-brutal-ink font-display font-bold text-[11px] tracking-wide">
        <AlertCircle size={16} className="text-brutal-blue flex-shrink-0 mt-0.5" />
        <div>
          <span>Neo-Brutalist Scheduling Matrix: Click inside any cell under a team member name and enter the scheduled days (e.g. 10, 11, "5,16" or "2,4,8,12,15-20") for audits. Click "SAVE BOARD" at the top right to save changes.</span>
        </div>
      </div>

      {/* Scheduling Matrix Board */}
      <div className="brutal-border brutal-shadow bg-brutal-cream overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[800px]">
            <thead>
              <tr className="brutal-border-b bg-brutal-ink text-white font-display font-bold text-[10px] tracking-[0.2em] uppercase">
                <th className="p-4 w-16 text-center">SR. NO.</th>
                <th className="p-4 w-80">COMPANY / CLIENT</th>
                {schedule.members.map(m => (
                  <th key={m.email} className="p-4 text-center group relative">
                    <div className="flex items-center justify-center gap-2">
                      <span>{m.name}</span>
                      <button
                        onClick={() => handleRemoveMember(m.email)}
                        className="opacity-0 group-hover:opacity-100 text-brutal-red hover:scale-115 transition"
                        title="Remove member from board"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="p-4 w-20 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y-[2px] divide-brutal-ink/10 font-display font-bold text-[12px] tracking-tight">
              {schedule.companies.map((company, index) => (
                <tr key={company} className="hover:bg-brutal-yellow/5 transition-colors border-b brutal-border-b">
                  <td className="p-4 text-center num text-brutal-ink/65">{index + 1}</td>
                  <td className="p-4 font-extrabold text-[13px] tracking-tight">{company}</td>
                  {schedule.members.map(m => (
                    <td key={m.email} className="p-2 text-center">
                      <input
                        type="text"
                        value={getCellDays(company, m.email)}
                        onChange={e => handleCellChange(company, m.email, e.target.value)}
                        placeholder="—"
                        className="w-full max-w-[140px] text-center border-2 border-dashed border-brutal-ink/20 hover:border-brutal-ink focus:border-brutal-blue focus:outline-none bg-transparent px-2 py-1.5 font-display font-bold text-[13px] num transition-all"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleRemoveCompany(company)}
                      className="w-8 h-8 grid place-items-center border-2 border-brutal-ink bg-brutal-cream text-brutal-red hover:bg-brutal-red hover:text-white transition-all brutal-shadow-sm"
                      title="Remove Company"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
