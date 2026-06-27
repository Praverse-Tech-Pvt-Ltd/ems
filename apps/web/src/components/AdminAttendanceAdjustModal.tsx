'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2, Calendar, User, Clock, ClipboardList, AlertCircle } from 'lucide-react';
import { employeesService } from '@/lib/api/employees';
import { attendanceService } from '@/lib/api/attendance';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

export function AdminAttendanceAdjustModal({
  onClose,
  onSuccess,
  defaultEmployeeId,
  defaultDate,
  defaultStatus,
}: {
  onClose: () => void;
  onSuccess: () => void;
  defaultEmployeeId?: string;
  defaultDate?: string;
  defaultStatus?: string;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(defaultEmployeeId ?? '');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (defaultDate) return defaultDate;
    const today = new Date();
    return today.toISOString().split('T')[0] || '';
  });
  const [punchInTime, setPunchInTime] = useState('');
  const [punchOutTime, setPunchOutTime] = useState('');
  const [status, setStatus] = useState(defaultStatus ?? 'PRESENT');
  const [reason, setReason] = useState('');

  // Fetch employees on mount
  useEffect(() => {
    employeesService.list()
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data ?? [];
        setEmployees(list);
        if (list.length > 0 && !defaultEmployeeId) {
          setSelectedEmployeeId(list[0].id);
        }
      })
      .catch(err => {
        setErrorMsg('Could not load employees. Please close and try again.');
      })
      .finally(() => {
        setLoadingEmployees(false);
      });
  }, [defaultEmployeeId]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeId) {
      setErrorMsg('Please select an employee.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Please provide a reason for manual adjustment.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await attendanceService.adminUpsert({
        employeeId: selectedEmployeeId,
        date: new Date(selectedDate).toISOString(),
        punchInTime: punchInTime ? new Date(`${selectedDate}T${punchInTime}:00+05:30`).toISOString() : undefined,
        punchOutTime: punchOutTime ? new Date(`${selectedDate}T${punchOutTime}:00+05:30`).toISOString() : undefined,
        status,
        reason,
      });

      setSuccessMsg('Attendance record adjusted successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      const rawMsg = err?.response?.data?.message;
      setErrorMsg(Array.isArray(rawMsg) ? rawMsg.join('. ') : (rawMsg ?? 'Failed to adjust attendance. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }, [selectedEmployeeId, selectedDate, punchInTime, punchOutTime, status, reason, onClose, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(19,27,46,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[500px] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: 'rgba(250,248,255,0.98)',
          boxShadow: '0 24px 64px rgba(19,27,46,0.18), 0 4px 16px rgba(19,27,46,0.08)',
          border: '1px solid rgba(226,191,181,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(170,48,0,0.08) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(226,191,181,0.35)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(170,48,0,0.15)' }}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: '#aa3000', fontVariationSettings: "'FILL' 1" }}
              >
                edit_calendar
              </span>
            </div>
            <div>
              <div className="text-[13px] font-bold text-on-surface leading-tight">
                Admin: Manual Attendance Adjustment
              </div>
              <div className="text-[11px] text-on-surface-variant/60 font-medium">
                Log or update employee punch records directly
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body Form */}
        {loadingEmployees ? (
          <div className="p-8 flex flex-col items-center justify-center gap-sm">
            <Loader2 className="animate-spin text-primary" size={24} />
            <p className="text-xs text-on-surface-variant">Loading employee directory...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-md overflow-y-auto flex-1">
            {errorMsg && (
              <div className="flex items-center gap-2 p-sm bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 p-sm bg-success/10 border border-success/20 rounded-xl text-success text-xs font-semibold">
                <Check size={14} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Employee Selection */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant/80 tracking-wider font-label-caps uppercase mb-1">
                Select Employee
              </label>
              <div className="relative">
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="w-full pl-9 pr-sm py-2 text-sm rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary focus:outline-none appearance-none"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
                <User size={14} className="absolute left-3 top-3 text-on-surface-variant/60" />
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant/80 tracking-wider font-label-caps uppercase mb-1">
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full pl-9 pr-sm py-2 text-sm rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary focus:outline-none"
                />
                <Calendar size={14} className="absolute left-3 top-3 text-on-surface-variant/60" />
              </div>
            </div>

            {/* Punch Times */}
            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant/80 tracking-wider font-label-caps uppercase mb-1">
                  Punch In Time (Optional)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={punchInTime}
                    onChange={e => setPunchInTime(e.target.value)}
                    className="w-full pl-9 pr-sm py-2 text-sm rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary focus:outline-none"
                  />
                  <Clock size={14} className="absolute left-3 top-3 text-on-surface-variant/60" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant/80 tracking-wider font-label-caps uppercase mb-1">
                  Punch Out Time (Optional)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={punchOutTime}
                    onChange={e => setPunchOutTime(e.target.value)}
                    className="w-full pl-9 pr-sm py-2 text-sm rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary focus:outline-none"
                  />
                  <Clock size={14} className="absolute left-3 top-3 text-on-surface-variant/60" />
                </div>
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant/80 tracking-wider font-label-caps uppercase mb-1">
                Attendance Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full pl-9 pr-sm py-2 text-sm rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface focus:border-primary focus:outline-none appearance-none"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="WFH">WFH</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LEAVE">LEAVE</option>
                  <option value="HOLIDAY">HOLIDAY</option>
                  <option value="MISSING_PUNCH_OUT">MISSING PUNCH OUT</option>
                </select>
                <ClipboardList size={14} className="absolute left-3 top-3 text-on-surface-variant/60" />
              </div>
            </div>

            {/* Adjustment Reason */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant/80 tracking-wider font-label-caps uppercase mb-1">
                Adjustment Reason / Justification
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Provide details about why this adjustment is being made (e.g. forgot card, travel adjustment, client visit approval)..."
                rows={3}
                className="w-full p-sm text-sm rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-sm justify-end pt-sm border-t border-outline-variant/20">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-sm border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-sm bg-primary text-on-primary font-bold shadow-md hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-xs disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save Adjustment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
