import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const IST = 'Asia/Kolkata';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: IST, day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** HH:MM (24-hour) in IST */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-GB', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return (
    d.toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false })
  );
}

export function slugToLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}
