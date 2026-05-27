// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

// ── Enums ─────────────────────────────────────────────────────────────────────

export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type AttendanceStatus =
  | 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY'
  | 'WFH' | 'LEAVE' | 'HOLIDAY' | 'MISSING_PUNCH_OUT';
export type ExpenseCategory =
  | 'TRAVEL' | 'FOOD' | 'OFFICE' | 'CLIENT_VISIT'
  | 'HOTEL' | 'STATIONERY' | 'MISC';
export type PaymentMode = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';
export type ExpenseStatus =
  | 'DRAFT' | 'SUBMITTED' | 'L1_REVIEW' | 'FINANCE_REVIEW'
  | 'APPROVED' | 'REJECTED' | 'PAID';
export type InvoiceType = 'VENDOR' | 'CLIENT';
export type InvoiceStatus =
  | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID' | 'OVERDUE';
export type LeaveType = 'CL' | 'SL' | 'PL' | 'UL' | 'CO';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RequestType =
  | 'WFH' | 'ADVANCE_PAYMENT' | 'DOCUMENT_REQUEST' | 'ASSET_REQUEST'
  | 'TRAVEL_APPROVAL' | 'ATTENDANCE_CORRECTION' | 'OTHER';
export type RequestStatus =
  | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// ── Domain Models ─────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  designation?: string;
  role: Role;
  status: EmployeeStatus;
  joiningDate: string;
  faceEnrolled: boolean;
  department?: Department;
  manager?: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
  approvalAuthority?: string[];
  address?: string;
  emergencyContact?: string;
  salaryGrade?: string;
  grossSalary?: number | string;
  profilePhotoUrl?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  punchInTime: string | null;
  punchOutTime: string | null;
  status: AttendanceStatus;
  workingHours: number | null;
  isRegularized: boolean;
}

export interface AttendanceStats {
  month: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysHalfDay: number;
  daysOnLeave: number;
  daysAbsent: number;
  attendedDays: number;
  attendancePercent: number;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description?: string;
  paymentMode?: PaymentMode;
  status: ExpenseStatus;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  partyName: string;
  amount: number;
  gstPercent?: number;
  dueDate: string;
  description?: string;
  status: InvoiceStatus;
}

export interface LeaveBalance {
  leaveType: LeaveType;
  totalDays: number;
  usedDays: number;
  year: number;
}

export interface LeaveRequest {
  id: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

export interface SalarySlip {
  id: string;
  month: number;
  year: number;
  grossSalary: number;
  deductions: number;
  netPayable: number;
  lopDays: number;
  daysPresent: number;
}

export interface EmployeeRequest {
  id: string;
  requestType: RequestType;
  details: Record<string, unknown>;
  status: RequestStatus;
  comment?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  pendingExpenses: number;
  pendingLeaves: number;
  overdueInvoices: number;
  missingPunchOuts: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export type ChatChannelType = 'GENERAL' | 'GROUP' | 'DIRECT';

export interface ChatAuthor {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  body: string;
  createdAt: string;
  author: ChatAuthor;
}

export interface ChatChannel {
  id: string;
  name: string;
  type: ChatChannelType;
  members: ChatAuthor[];
  lastMessage: ChatMessage | null;
  unread: number;
  lastReadAt: string | null;
  otherMember: ChatAuthor | null;
}
