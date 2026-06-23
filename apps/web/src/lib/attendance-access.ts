const ATTENDANCE_BLOCKED_EMAILS = new Set([
  'ashwani@nexgenpharmasolutions.com',
]);

export function isAttendanceBlockedUser(user?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null) {
  const email = user?.email?.trim().toLowerCase();
  if (email && ATTENDANCE_BLOCKED_EMAILS.has(email)) {
    return true;
  }

  const firstName = user?.firstName?.trim().toLowerCase();
  const lastName = user?.lastName?.trim().toLowerCase();
  return lastName === 'shrivastav' && firstName === 'ashwani';
}
