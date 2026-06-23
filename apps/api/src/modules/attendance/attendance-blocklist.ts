export const ATTENDANCE_BLOCKED_EMAILS = [
  'ashwani@nexgenpharmasolutions.com',
] as const;

export const ATTENDANCE_BLOCKED_MESSAGE = 'Attendance is disabled for this user.';

export function isAttendanceBlockedIdentity(employee?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null) {
  const email = employee?.email?.trim().toLowerCase();
  if (email && (ATTENDANCE_BLOCKED_EMAILS as readonly string[]).includes(email)) {
    return true;
  }

  const firstName = employee?.firstName?.trim().toLowerCase();
  const lastName = employee?.lastName?.trim().toLowerCase();
  return lastName === 'shrivastav' && firstName === 'ashwani';
}
