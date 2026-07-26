/**
 * دخول لوحة التحكم على سيرفر v2.
 *
 * v1 signed in with Firebase Auth and then read `admins/{uid}` FROM THE BROWSER
 * to decide whether the account was staff — which means the browser decided.
 * Here the server decides twice: `/identity/login` proves the password, and
 * `/admin/me` (behind AdminGuard) proves the role. The panel only ever learns
 * the answer.
 *
 * The two storage keys are kept apart on purpose:
 *   `linkup.v2.admin.token` — the bearer token, read by every request (v2Api).
 *   `admin_auth` / `admin_uid` / `admin_email` / `admin_name` — the UI session
 *   keys v1's pages, sidebar and route guard already read. Keeping their names
 *   means no page has to change.
 */

import { setV2Token, v2, V2ApiError } from '@/lib/v2Api';

export interface AdminMe {
  uid: string;
  name: string;
  role: 'admin' | 'superadmin';
  isSuper: boolean;
  permissions: string[];
}

interface LoginResponse {
  token: string;
  user: { id: string; displayName?: string; email?: string; publicAccountId?: string };
}

/** Log in, then confirm this account is staff. Throws on either failure. */
export async function adminLogin(email: string, password: string): Promise<AdminMe> {
  // `identifier` accepts an email OR the 8-digit account id, same as the app.
  const auth = await v2.login<LoginResponse>('/identity/login', {
    identifier: email.trim(),
    password,
  });
  if (!auth?.token) throw new V2ApiError(500, 'unknown', 'استجابة غير متوقعة من الخادم');

  // Hold the token before asking who we are — /admin/me needs it.
  setV2Token(auth.token);
  try {
    const me = await v2.get<AdminMe>('/admin/me');
    if (!me?.uid) throw new V2ApiError(403, 'not-admin', 'هذا الحساب لا يملك صلاحية الدخول');
    return me;
  } catch (e) {
    // A non-admin who typed the right password must NOT stay logged in.
    setV2Token(null);
    throw e;
  }
}

/** Re-read the identity for an existing token — used on app boot. */
export function fetchAdminMe(): Promise<AdminMe> {
  return v2.get<AdminMe>('/admin/me');
}

/** Drop every trace of the session (token + the UI keys v1's pages read). */
export function clearAdminSession(): void {
  setV2Token(null);
  for (const key of ['admin_auth', 'admin_uid', 'admin_email', 'admin_name']) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage disabled — nothing to clear */
    }
  }
}
