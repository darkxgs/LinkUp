/**
 * جلسات دخول لوحة التحكم — تسجيل، نبضة حياة، إجبار خروج.
 *
 * Same four operations v1 had, now on our own server (`/admin/sessions/*`)
 * instead of Firebase Functions plus a Firestore collection. Every caller and
 * signature is unchanged, so no page had to be touched.
 *
 * One behaviour worth knowing: the server tracks these in Redis. With no
 * REDIS_URL it answers `tracked: false` and the heartbeat always reports "not
 * revoked" — tracking is off, which must NOT be read as "you were kicked out".
 */

import { v2 } from '@/lib/v2Api';

const DEVICE_KEY = 'admin_device_id';
const SESSION_KEY = 'admin_session_id';
const SESSION_VERSION_KEY = 'admin_session_version';

export type AdminSessionLocation = {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  isp?: string;
  latitude?: number;
  longitude?: number;
  source?: 'ip' | 'browser' | 'none';
};

export type AdminPanelSession = {
  id: string;
  adminUid: string;
  adminEmail: string;
  adminName: string;
  adminRole: 'super' | 'country';
  deviceId: string;
  userAgent: string;
  browser: string;
  platform: string;
  language: string;
  screen: string;
  ip: string;
  location: AdminSessionLocation | null;
  status: 'active' | 'ended' | 'revoked';
  sessionVersion: number;
  createdAt: number;
  lastSeenAt: number;
  endedAt: number | null;
  endedReason: string | null;
};

export function getOrCreateAdminDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `adev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getStoredAdminSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function clearAdminSessionLocal(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_VERSION_KEY);
  localStorage.removeItem('admin_auth');
  localStorage.removeItem('admin_uid');
  localStorage.removeItem('admin_email');
  localStorage.removeItem('admin_name');
  // The bearer token dies with the session, or the next visitor to this browser
  // would still be able to call the API.
  localStorage.removeItem('linkup.v2.admin.token');
}

function parseUa(): { browser: string; platform: string } {
  const ua = navigator.userAgent || '';
  let browser = 'متصفح';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let platform = 'Web';
  if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) platform = 'macOS';
  else if (/Android/i.test(ua)) platform = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  return { browser, platform };
}

function tryBrowserLocation(): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 },
    );
  });
}

export async function recordAdminLoginSession(): Promise<{
  sessionId: string;
  ip: string;
  location: AdminSessionLocation | null;
}> {
  const { browser, platform } = parseUa();
  const location = await tryBrowserLocation();
  // The IP is read off the request BY THE SERVER: a browser cannot know its own
  // public address, and asking a third-party service for it would hand the
  // admin's address to that service.
  const res = await v2.post<{
    sessionId: string;
    sessionVersion: number;
    ip: string;
    location: AdminSessionLocation | null;
    tracked: boolean;
  }>('/admin/sessions/record', {
    deviceId: getOrCreateAdminDeviceId(),
    userAgent: navigator.userAgent,
    browser,
    platform,
    language: navigator.language || '',
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
    email: localStorage.getItem('admin_email') ?? '',
    location,
  });

  localStorage.setItem(SESSION_KEY, res.sessionId);
  localStorage.setItem(SESSION_VERSION_KEY, String(res.sessionVersion ?? 0));
  return { sessionId: res.sessionId, ip: res.ip, location: res.location };
}

export async function heartbeatAdminSession(): Promise<{ ok: boolean; revoked: boolean; reason?: string }> {
  const sessionId = getStoredAdminSessionId();
  if (!sessionId) return { ok: false, revoked: true, reason: 'no_session' };
  try {
    return await v2.post<{ ok: boolean; revoked: boolean; reason?: string }>(
      '/admin/sessions/heartbeat',
      { sessionId },
    );
  } catch {
    // A failed request is a network blip, NOT a revocation — answering `revoked`
    // here would sign the admin out every time the connection stutters.
    return { ok: false, revoked: false };
  }
}

export async function endAdminLoginSession(): Promise<void> {
  const sessionId = getStoredAdminSessionId();
  if (!sessionId) return;
  try {
    await v2.post('/admin/sessions/end', { sessionId });
  } catch {
    // Signing out locally matters more than recording that we did.
  }
}

export async function forceLogoutAdminSessions(input: {
  targetUid?: string;
  sessionId?: string;
  revokeAll?: boolean;
  reason?: string;
}): Promise<void> {
  await v2.post('/admin/sessions/force-logout', input);
}

interface ServerSession {
  id: string;
  adminUid: string;
  adminEmail: string;
  adminName: string;
  adminRole: string;
  deviceId: string;
  userAgent: string;
  browser: string;
  platform: string;
  language: string;
  screen: string;
  ip: string;
  location: AdminSessionLocation | null;
  status: string;
  sessionVersion: number;
  createdAt: number;
  lastSeenAt: number;
  endedAt: number | null;
  endedReason: string | null;
}

/** Server row → the panel's shape. v2's `superadmin` is v1's «super»; a plain
 *  admin is shown the way v1 showed a country-scoped one. */
function mapSession(s: ServerSession): AdminPanelSession {
  const status: AdminPanelSession['status'] =
    s.status === 'active' || s.status === 'revoked' ? s.status : 'ended';
  return {
    ...s,
    adminRole: s.adminRole === 'superadmin' ? 'super' : 'country',
    status,
    location: s.location ?? null,
  };
}

export const listAdminSessions = async (opts?: {
  status?: 'active' | 'ended' | 'revoked' | 'all';
  limitCount?: number;
}): Promise<AdminPanelSession[]> => {
  const status = opts?.status ?? 'all';
  const limitCount = opts?.limitCount ?? 150;
  try {
    const rows = await v2.get<ServerSession[]>(
      `/admin/sessions?status=${encodeURIComponent(status)}&limit=${limitCount}`,
    );
    return (rows ?? []).map(mapSession);
  } catch (e) {
    console.error('listAdminSessions:', e);
    return [];
  }
};

/** How often the panel asks whether its own session is still valid. */
const WATCH_INTERVAL_MS = 60_000;

/**
 * مراقبة الجلسة الحالية — يستدعي onRevoked عند الإبطال.
 *
 * v1 ran two Firestore onSnapshot listeners for this. The heartbeat already
 * answers the same three questions (session ended? version bumped? account no
 * longer an admin? — AdminGuard re-reads the user row on every request), so a
 * single poll replaces both listeners.
 */
export function watchCurrentAdminSession(onRevoked: (reason: string) => void): () => void {
  if (!getStoredAdminSessionId() || !localStorage.getItem('admin_uid')) return () => undefined;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const res = await heartbeatAdminSession();
    if (!stopped && res.revoked) onRevoked(res.reason ?? 'revoked');
  };

  void tick();
  const timer = setInterval(() => void tick(), WATCH_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function formatAdminSessionLocation(loc: AdminSessionLocation | null | undefined): string {
  if (!loc) return '—';
  const parts = [loc.city, loc.region, loc.country || loc.countryCode].filter(Boolean);
  const base = parts.length ? parts.join('، ') : '—';
  if (loc.isp) return `${base} · ${loc.isp}`;
  if (loc.latitude != null && loc.longitude != null && parts.length === 0) {
    return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  }
  return base;
}
