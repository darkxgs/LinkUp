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

/**
 * Returns the range of geohash prefixes that cover a bounding box
 * around the given center at the given radius.
 */
function geohashRange(lat: number, lng: number, radiusKm: number): { lower: string; upper: string } {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.320 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const lower = encodeGeohash(minLat, minLng, 4);
  const upper = encodeGeohash(maxLat, maxLng, 4);

  return { lower: lower < upper ? lower : upper, upper: lower < upper ? upper : lower };
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
    const { lower, upper } = geohashRange(lat, lng, radiusKm);

    const q = query(
      collection(firestore, 'users'),
      where('location.geohash', '>=', lower),
      where('location.geohash', '<=', upper + '\uf8ff'),
      limit(100),
    );

    const snap = await getDocs(q);
    const myUid = auth.currentUser?.uid;

    const results: NearbyUser[] = [];
    snap.docs.forEach((d) => {
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

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results.slice(0, maxResults);
  } catch (e) {
    console.warn('getNearbyUsers:', e);
    return [];
  }
}
