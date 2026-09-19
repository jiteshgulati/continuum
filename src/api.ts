import type {
  User,
  Employee,
  Knowledge,
  Interview,
  Conflict,
  Notification,
  Audit,
  Base,
} from '../server/types';
export type { Employee, Knowledge, Interview, Conflict, Document, Evidence } from '../server/types';
export type SafeUser = Omit<User, 'passwordHash'>;
export interface Bootstrap {
  user: SafeUser;
  organisation: Base & { name: string; reviewIntervalDays: number; isDemo?: boolean };
  ai: { provider: string; configured: boolean };
  employees: Employee[];
  knowledge: Knowledge[];
  interviews: Interview[];
  conflicts: Conflict[];
  notifications: Notification[];
  audit: Audit[];
}
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers:
      options.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw new Error(body.error || 'Something went wrong. Please try again.');
  }
  return body;
}
export const post = <T = unknown>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const riskOf = (p: Employee) =>
  p.employmentStatus !== 'Active' && p.backupExperts === 0 && p.criticalAreas > 0
    ? 'High'
    : p.backupExperts <= 1
      ? 'Medium'
      : 'Low';
export const date = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not yet verified';
export const initials = (name: string) =>
  name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('');
export const coverage = (cards: Knowledge[]) =>
  cards.length
    ? Math.round((cards.filter((c) => c.status === 'Verified').length / cards.length) * 100)
    : 0;
