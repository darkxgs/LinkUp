/**
 * Location Service — GPS + Geohash + Firestore nearby queries
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  limit,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { firestore, auth } from './firebase';
import { normalizeUserDoc, type UserDoc } from './firebase/users';

const LOCATION_UPDATE_KEY = '@linkup_last_location_update';
const MIN_UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ==================== GEOHASH ====================
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(
  lat: number,
  lng: number,
  precision = 6,
): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let hash = '';
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; }
      else { idx = idx * 2; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; }
      else { idx = idx * 2; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

/** Precision for nearby cell queries — smaller radius → finer cells */
function geohashPrecisionForRadius(radiusKm: number): number {
  if (radiusKm <= 2) return 6;
  if (radiusKm <= 8) return 5;
  if (radiusKm <= 25) return 4;
  return 3;
}

// جداول الجار القياسية لخوارزمية geohash-adjacent (المرجعية المعروفة) —
// نسخة PR #13 الأصلية كانت بجداول مبتورة وفهرسة خاطئة فتعيد خلية المركز غالباً.
const NEIGHBOR_TABLE = {
  right: {
    even: 'bc01fg45238967deuvhjyznpkmstqrwx',
    odd: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
  },
  left: {
    even: '238967debc01fg45kmstqrwxuvhjyznp',
    odd: '14365h7k9dcfesgujnmqp0r2twvyx8zb',
  },
  top: {
    even: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
    odd: 'bc01fg45238967deuvhjyznpkmstqrwx',
  },
  bottom: {
    even: '14365h7k9dcfesgujnmqp0r2twvyx8zb',
    odd: '238967debc01fg45kmstqrwxuvhjyznp',
  },
} as const;

const BORDER_TABLE = {
  right: { even: 'bcfguvyz', odd: 'prxz' },
  left: { even: '0145hjnp', odd: '028b' },
  top: { even: 'prxz', odd: 'bcfguvyz' },
  bottom: { even: '028b', odd: '0145hjnp' },
} as const;

type GeoDirection = keyof typeof NEIGHBOR_TABLE;

function geohashAdjacent(hash: string, direction: GeoDirection): string {
  if (!hash) return hash;
  // «odd» عندما يكون الطول فردياً — مطابق للتنفيذ المرجعي
  const type = hash.length % 2 === 1 ? 'odd' : 'even';
  const last = hash.slice(-1);
  let parent = hash.slice(0, -1);
  if (BORDER_TABLE[direction][type].indexOf(last) !== -1 && parent !== '') {
    parent = geohashAdjacent(parent, direction);
  }
  const idx = NEIGHBOR_TABLE[direction][type].indexOf(last);
  if (idx === -1) return hash; // حرف خارج base32 — لا جار
  return parent + BASE32.charAt(idx);
}

/** Center cell + 8 neighbors — single lexicographic range misses boundary users */
function geohashSearchPrefixes(lat: number, lng: number, radiusKm: number): string[] {
  const precision = geohashPrecisionForRadius(radiusKm);
  const center = encodeGeohash(lat, lng, precision);
  const prefixes = new Set<string>([center]);
  const north = geohashAdjacent(center, 'top');
  const south = geohashAdjacent(center, 'bottom');
  const east = geohashAdjacent(center, 'right');
  const west = geohashAdjacent(center, 'left');
  prefixes.add(north);
  prefixes.add(south);
  prefixes.add(east);
  prefixes.add(west);
  prefixes.add(geohashAdjacent(north, 'right'));
  prefixes.add(geohashAdjacent(north, 'left'));
  prefixes.add(geohashAdjacent(south, 'right'));
  prefixes.add(geohashAdjacent(south, 'left'));
  return Array.from(prefixes);
}

// ==================== HAVERSINE DISTANCE ====================
const R_EARTH_KM = 6371;

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R_EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} م`;
  if (km < 10) return `${km.toFixed(1)} كم`;
  return `${Math.round(km)} كم`;
}

// ==================== PERMISSIONS ====================
export async function requestLocationPermission(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

// ==================== UPDATE LOCATION ====================
const LOCATION_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function readDeviceCoords(): Promise<{ latitude: number; longitude: number } | null> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return null;

  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }
  } catch {
    /* ignore */
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    maximumAge: 60_000,
    timeout: 15_000,
  });
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  };
}

export async function updateUserLocation(force = false): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  if (!force) {
    const lastStr = await AsyncStorage.getItem(LOCATION_UPDATE_KEY);
    if (lastStr) {
      const elapsed = Date.now() - parseInt(lastStr, 10);
      if (elapsed < MIN_UPDATE_INTERVAL_MS) return null;
    }
  }

  const granted = await hasLocationPermission();
  if (!granted) return null;

  try {
    const coords = await readDeviceCoords();
    if (!coords) return null;

    const { latitude, longitude } = coords;
    const geohash = encodeGeohash(latitude, longitude, 6);

    await updateDoc(doc(firestore, 'users', uid), {
      location: {
        latitude,
        longitude,
        geohash,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    await AsyncStorage.setItem(LOCATION_UPDATE_KEY, String(Date.now()));
    const saved = { latitude, longitude };
    emitLocationSynced(saved);
    return saved;
  } catch (e) {
    console.warn('updateUserLocation:', e);
    return null;
  }
}

/** يطلب الإذن إن لزم، ثم يحدّث الموقع — للاستخدام عند فتح التطبيق */
export async function ensureUserLocationSynced(force = false): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  let granted = await hasLocationPermission();
  if (!granted) {
    granted = await requestLocationPermission();
  }
  if (!granted) {
    emitLocationSynced(null);
    return null;
  }
  const coords = await updateUserLocation(force);
  if (coords) return coords;

  // fallback: آخر موقع محفوظ في Firestore
  const stored = await getUserStoredLocation();
  if (stored) return { latitude: stored.latitude, longitude: stored.longitude };
  return null;
}

// ==================== BOOTSTRAP + LISTENERS ====================
type LocationCoords = { latitude: number; longitude: number };
type LocationSyncListener = (coords: LocationCoords | null) => void;
const locationSyncListeners = new Set<LocationSyncListener>();

function emitLocationSynced(coords: LocationCoords | null): void {
  locationSyncListeners.forEach((fn) => {
    try {
      fn(coords);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeLocationSynced(listener: LocationSyncListener): () => void {
  locationSyncListeners.add(listener);
  return () => {
    locationSyncListeners.delete(listener);
  };
}

export async function getUserStoredLocation(
  uid?: string,
): Promise<(LocationCoords & { updatedAt?: number }) | null> {
  const id = uid ?? auth.currentUser?.uid;
  if (!id) return null;
  try {
    const snap = await getDoc(doc(firestore, 'users', id));
    if (!snap.exists()) return null;
    const loc = snap.data()?.location as
      | { latitude?: number; longitude?: number; updatedAt?: number }
      | undefined;
    if (loc?.latitude == null || loc?.longitude == null) return null;
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      updatedAt: typeof loc.updatedAt === 'number' ? loc.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export async function userNeedsLocationBootstrap(): Promise<boolean> {
  const granted = await hasLocationPermission();
  if (!granted) return true;
  const stored = await getUserStoredLocation();
  if (!stored) return true;
  const updatedAt = stored.updatedAt ?? 0;
  if (updatedAt > 0 && Date.now() - updatedAt > LOCATION_STALE_MS) return true;
  return false;
}

/** عند فتح التطبيق — يطلب الإذن إن لم يُمنح ويخزّن الإحداثيات */
export async function bootstrapUserLocation(): Promise<LocationCoords | null> {
  return ensureUserLocationSynced(true);
}

// ==================== NEARBY USERS QUERY ====================
export type NearbyUser = UserDoc & { distanceKm: number };

export async function getNearbyUsers(
  lat: number,
  lng: number,
  radiusKm = 50,
  maxResults = 40,
): Promise<NearbyUser[]> {
  try {
    const prefixes = geohashSearchPrefixes(lat, lng, radiusKm);
    const myUid = auth.currentUser?.uid;
    const seen = new Set<string>();
    const results: NearbyUser[] = [];

    for (const prefix of prefixes) {
      const q = query(
        collection(firestore, 'users'),
        where('location.geohash', '>=', prefix),
        where('location.geohash', '<=', prefix + '\uf8ff'),
        limit(60),
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
      const data = d.data() as Record<string, unknown>;
      if (d.id === myUid) return;

      const privacy = data.privacyHideLocation;
      if (privacy === true) return;

      const loc = data.location as { latitude: number; longitude: number; geohash: string; updatedAt?: number } | undefined;
      if (loc?.latitude == null || loc?.longitude == null) return;

      const updatedAt = typeof loc.updatedAt === 'number' ? loc.updatedAt : 0;
      if (updatedAt > 0 && Date.now() - updatedAt > LOCATION_STALE_MS) return;

      const dist = calculateDistance(lat, lng, loc.latitude, loc.longitude);
      if (dist > radiusKm) return;

        const user = normalizeUserDoc(d.id, data);
        results.push({ ...user, distanceKm: dist });
      });
    }

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results.slice(0, maxResults);
  } catch (e) {
    console.warn('getNearbyUsers:', e);
    return [];
  }
}
