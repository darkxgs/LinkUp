/**
 * `config/*` على قاعدة v2 — a drop-in replacement for the three Firestore
 * shapes this panel used against the config collection:
 *
 *   getDoc(doc(firestore, 'config', id))                   → readConfig(id)
 *   setDoc(doc(firestore, 'config', id), patch, {merge:1})  → mergeConfig(id, patch)
 *   onSnapshot(doc(firestore, 'config', id), cb)            → watchConfig(id, cb)
 *
 * Every catalogue screen (الهدايا، المتجر، VIP، الألعاب، الأرستقراطية، الألقاب،
 * مهام المضيفات، الإطارات، خلفيات الدردشة، حزم الشحن، مركز المكافآت، مستويات
 * الوكالة، أسعار المكالمات، الخصوصية، صفحات عن التطبيق …) goes through here, so
 * one small file moves about twenty pages onto our server without touching the
 * pages themselves.
 *
 * ── THE ONE THING THAT MATTERS ──────────────────────────────────────────────
 * `PUT /admin/config/:id` REPLACES the document wholesale, while Firestore's
 * `setDoc(..., { merge: true })` only touched the keys you passed. If this shim
 * forwarded a patch as-is, saving the Gifts page would DELETE every other field
 * in `config/gifts` — categories, rarities, the lot. So a merge is performed
 * here: read the current doc, deep-merge the patch, write the result back.
 * `deleteField()` has no equivalent; pass null and the key is dropped.
 */

import { v2 } from './v2Api';

export type ConfigData = Record<string, unknown>;

interface ConfigDocResponse {
  id: string;
  data: ConfigData;
}

/** A read that treats "never created" as empty rather than an error, because
 *  several of these docs legitimately do not exist until first save. */
export async function readConfig(id: string): Promise<ConfigData> {
  try {
    const res = await v2.get<ConfigDocResponse>(`/admin/config/${encodeURIComponent(id)}`);
    return res?.data ?? {};
  } catch (e) {
    if (isNotFound(e)) return {};
    throw e;
  }
}

/** Does the doc exist at all — the equivalent of `snap.exists()`. */
export async function configExists(id: string): Promise<boolean> {
  try {
    await v2.get<ConfigDocResponse>(`/admin/config/${encodeURIComponent(id)}`);
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}

/**
 * A read that keeps the existence flag, because several screens must tell
 * "never created" (⇒ it is safe to seed the defaults once) apart from "created
 * and deliberately emptied" (⇒ respect the emptiness). `config/gifts` is the
 * clearest case: without this distinction the sample gifts would come back every
 * time the owner deleted them.
 *
 * `data` is intentionally typed loose (`any` values), matching Firestore's
 * DocumentData, so the reading code above it needs no change.
 */
export async function readConfigSnapshot(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ exists: boolean; data: Record<string, any> }> {
  try {
    const res = await v2.get<ConfigDocResponse>(`/admin/config/${encodeURIComponent(id)}`);
    return { exists: true, data: res?.data ?? {} };
  } catch (e) {
    if (isNotFound(e)) return { exists: false, data: {} };
    throw e;
  }
}

/**
 * Firestore `setDoc(..., { merge: true })`. Objects are merged key by key;
 * ARRAYS ARE REPLACED, not concatenated — same as Firestore, and what every
 * catalogue screen expects when it saves a reordered list.
 */
export async function mergeConfig(id: string, patch: ConfigData): Promise<ConfigData> {
  const current = await readConfig(id);
  const next = deepMerge(current, patch);
  const res = await v2.put<ConfigDocResponse>(`/admin/config/${encodeURIComponent(id)}`, {
    data: next,
  });
  return res?.data ?? next;
}

/** Firestore `setDoc(...)` without merge — replaces the whole document. */
export async function replaceConfig(id: string, data: ConfigData): Promise<ConfigData> {
  const res = await v2.put<ConfigDocResponse>(`/admin/config/${encodeURIComponent(id)}`, {
    data,
  });
  return res?.data ?? data;
}

/** How often [watchConfig] re-reads. Config docs change when a human edits
 *  them, so seconds of latency are fine and polling stays cheap. */
const WATCH_INTERVAL_MS = 15_000;

/**
 * Firestore `onSnapshot` for a config doc. Our API is request/response, so this
 * polls; the callback fires immediately with the first read and then only when
 * the content actually CHANGES, so a page re-render is not triggered every tick.
 * Returns the unsubscribe function, exactly like onSnapshot did.
 */
export function watchConfig(
  id: string,
  onData: (data: ConfigData) => void,
  onError?: (e: unknown) => void,
): () => void {
  let stopped = false;
  let lastJson = '';

  const tick = async () => {
    if (stopped) return;
    try {
      const data = await readConfig(id);
      if (stopped) return;
      const json = JSON.stringify(data);
      if (json !== lastJson) {
        lastJson = json;
        onData(data);
      }
    } catch (e) {
      if (!stopped) onError?.(e);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), WATCH_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// ---------------------------------------------------------------- internals

function isNotFound(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  const code = (e as { code?: string } | null)?.code;
  return status === 404 || code === 'config-not-found';
}

function isPlainObject(v: unknown): v is ConfigData {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge `patch` into `base`. null drops the key (Firestore deleteField). */
export function deepMerge(base: ConfigData, patch: ConfigData): ConfigData {
  const out: ConfigData = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete out[key];
      continue;
    }
    const prev = out[key];
    out[key] = isPlainObject(prev) && isPlainObject(value) ? deepMerge(prev, value) : value;
  }
  return out;
}
