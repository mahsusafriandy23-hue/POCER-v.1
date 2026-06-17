"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerLocation } from "./api";

/**
 * Outlet selection with optional geolocation-based "nearest outlet" auto-pick.
 *
 * Rules:
 *  - Auto-select the nearest outlet on first visit (if geolocation allowed).
 *  - Manual selection is always available and always overrides automatic.
 *  - Manual choice is stored persistently and never auto-changed.
 *  - When the user has moved and a meaningfully closer outlet exists, surface a
 *    *recommendation* — but never switch automatically.
 *  - Denied permission / unavailable location degrades gracefully (keeps the
 *    stored choice, or the first outlet as a neutral default).
 */

const PREF_KEY = "mascafi.outlet"; // { id: number, manual: boolean }
// A different outlet is only recommended when it is at least this much closer
// (km) than the current one — avoids nagging for marginal differences.
const RECOMMEND_MARGIN_KM = 5;

type Pref = { id: number; manual: boolean };

function readPref(): Pref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.id === "number") return { id: p.id, manual: !!p.manual };
  } catch {
    /* ignore */
  }
  return null;
}

function writePref(p: Pref) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Haversine distance in km between two coordinates. */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function withCoords(servers: ServerLocation[]) {
  return servers.filter(
    (s) => typeof s.latitude === "number" && typeof s.longitude === "number",
  ) as (ServerLocation & { latitude: number; longitude: number })[];
}

function nearestTo(servers: ServerLocation[], lat: number, lng: number) {
  const list = withCoords(servers);
  if (!list.length) return null;
  let best = list[0];
  let bestD = distanceKm(lat, lng, best.latitude, best.longitude);
  for (const s of list.slice(1)) {
    const d = distanceKm(lat, lng, s.latitude, s.longitude);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return { server: best as ServerLocation, distanceKm: bestD };
}

export type OutletSelection = {
  activeId: number | null;
  /** User explicitly picks an outlet (overrides + persists as manual). */
  selectManual: (id: number) => void;
  /** A nearer outlet we suggest switching to (never auto-applied). */
  recommendation: ServerLocation | null;
  acceptRecommendation: () => void;
  dismissRecommendation: () => void;
  /** "granted" | "denied" | "unavailable" | "idle" — for graceful UI, optional. */
  geoStatus: "idle" | "granted" | "denied" | "unavailable";
};

export function useOutletSelection(servers: ServerLocation[]): OutletSelection {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [recommendation, setRecommendation] = useState<ServerLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<OutletSelection["geoStatus"]>("idle");
  const geoTried = useRef(false);

  // 1) Seed from stored preference or a neutral default as soon as servers load.
  useEffect(() => {
    if (!servers.length) return;
    setActiveId((cur) => {
      if (cur != null && servers.some((s) => s.id === cur)) return cur;
      const pref = readPref();
      if (pref && servers.some((s) => s.id === pref.id)) return pref.id;
      return servers[0].id; // neutral default until geolocation resolves
    });
  }, [servers]);

  // 2) Try geolocation once to auto-pick (first visit) or recommend (returning).
  useEffect(() => {
    if (!servers.length || geoTried.current) return;
    geoTried.current = true;

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestTo(servers, pos.coords.latitude, pos.coords.longitude);
        if (!near) {
          setGeoStatus("unavailable");
          return;
        }
        setGeoStatus("granted");
        const pref = readPref();

        if (!pref) {
          // First visit: auto-select nearest and remember (as automatic).
          setActiveId(near.server.id);
          writePref({ id: near.server.id, manual: false });
          return;
        }

        // Returning user: never auto-switch. Recommend only when the nearer
        // outlet actually covers the user AND they've left their current
        // outlet's coverage (or the nearer one is clearly closer).
        if (near.server.id !== pref.id) {
          const cur = withCoords(servers).find((s) => s.id === pref.id);
          const curDist = cur
            ? distanceKm(pos.coords.latitude, pos.coords.longitude, cur.latitude, cur.longitude)
            : Infinity;
          const nearRadius = near.server.serviceRadiusKm ?? RECOMMEND_MARGIN_KM;
          const curRadius = cur?.serviceRadiusKm ?? RECOMMEND_MARGIN_KM;
          const userInNear = near.distanceKm <= nearRadius;
          const userOutOfCurrent = curDist > curRadius;
          const muchCloser = curDist - near.distanceKm >= RECOMMEND_MARGIN_KM;
          if (userInNear && (userOutOfCurrent || muchCloser)) {
            setRecommendation(near.server);
          }
        }
      },
      () => {
        setGeoStatus("denied"); // denied or error → keep current selection
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, [servers]);

  const selectManual = useCallback((id: number) => {
    setActiveId(id);
    writePref({ id, manual: true });
    setRecommendation(null);
  }, []);

  const acceptRecommendation = useCallback(() => {
    setRecommendation((rec) => {
      if (rec) {
        setActiveId(rec.id);
        writePref({ id: rec.id, manual: true }); // accepting is an explicit choice
      }
      return null;
    });
  }, []);

  const dismissRecommendation = useCallback(() => setRecommendation(null), []);

  return { activeId, selectManual, recommendation, acceptRecommendation, dismissRecommendation, geoStatus };
}
