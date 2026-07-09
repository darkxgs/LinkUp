/** Base path for the admin dashboard (e.g. `/admin/users`). */
export const ADMIN_BASE = '/admin';

export function adminPath(path = ''): string {
  if (!path || path === '/') return ADMIN_BASE;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${ADMIN_BASE}${normalized}`;
}
