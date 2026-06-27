const ATTENDANCE_BLOCKED_EMAILS = new Set([
  'ashwani@nexgenpharmasolutions.com',
]);

/** ADMIN and SUPER_ADMIN don't punch in/out personally — they manage the team's attendance instead. */
const PUNCH_DISABLED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

export function isAttendanceBlockedUser(user?: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
} | null) {
  if (user?.role && PUNCH_DISABLED_ROLES.has(user.role)) {
    return true;
  }

  const email = user?.email?.trim().toLowerCase();
  if (email && ATTENDANCE_BLOCKED_EMAILS.has(email)) {
    return true;
  }

  const firstName = user?.firstName?.trim().toLowerCase();
  const lastName = user?.lastName?.trim().toLowerCase();
  return lastName === 'shrivastav' && firstName === 'ashwani';
}
