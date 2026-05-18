// ── Status colour maps ────────────────────────────────────────────────────────

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  PRESENT:            'bg-green-100 text-green-700',
  LATE:               'bg-[#ffa23a] text-brutal-ink',
  ABSENT:             'bg-red-100 text-red-700',
  HALF_DAY:           'bg-orange-100 text-orange-700',
  WFH:                'bg-blue-100 text-blue-700',
  LEAVE:              'bg-purple-100 text-purple-700',
  HOLIDAY:            'bg-slate-100 text-slate-600',
  MISSING_PUNCH_OUT:  'bg-red-100 text-red-700',
};

export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT:            'bg-slate-100 text-slate-600',
  SUBMITTED:        'bg-blue-100 text-blue-700',
  L1_REVIEW:        'bg-[#ffa23a] text-brutal-ink',
  FINANCE_REVIEW:   'bg-orange-100 text-orange-700',
  APPROVED:         'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-700',
  PAID:             'bg-emerald-100 text-emerald-700',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  PENDING:      'bg-[#ffa23a] text-brutal-ink',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED:     'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
  PAID:         'bg-emerald-100 text-emerald-700',
  OVERDUE:      'bg-red-100 text-red-700',
};

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-[#ffa23a] text-brutal-ink',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export const REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING:      'bg-[#ffa23a] text-brutal-ink',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED:     'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
  CANCELLED:    'bg-slate-100 text-slate-600',
};

// ── Dropdown options ──────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  { value: 'TRAVEL',       label: 'Travel' },
  { value: 'FOOD',         label: 'Food' },
  { value: 'OFFICE',       label: 'Office' },
  { value: 'CLIENT_VISIT', label: 'Client Visit' },
  { value: 'HOTEL',        label: 'Hotel' },
  { value: 'STATIONERY',   label: 'Stationery' },
  { value: 'MISC',         label: 'Miscellaneous' },
] as const;

export const PAYMENT_MODES = [
  { value: 'CASH',          label: 'Cash' },
  { value: 'CARD',          label: 'Card' },
  { value: 'UPI',           label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
] as const;

export const LEAVE_TYPES = [
  { value: 'CL', label: 'Casual Leave' },
  { value: 'SL', label: 'Sick Leave' },
  { value: 'PL', label: 'Paid Leave' },
  { value: 'UL', label: 'Unpaid Leave' },
  { value: 'CO', label: 'On Duty (OD)' },
] as const;

export const REQUEST_TYPES = [
  { value: 'WFH',                   label: 'Work From Home' },
  { value: 'ADVANCE_PAYMENT',       label: 'Advance Payment' },
  { value: 'DOCUMENT_REQUEST',      label: 'Document Request' },
  { value: 'ASSET_REQUEST',         label: 'Asset Request' },
  { value: 'TRAVEL_APPROVAL',       label: 'Travel Approval' },
  { value: 'ATTENDANCE_CORRECTION', label: 'Attendance Correction' },
  { value: 'OTHER',                 label: 'Other' },
] as const;

export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const;

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
