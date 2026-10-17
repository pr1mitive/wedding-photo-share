"use client";

import { CONSENT_VERSION } from "./config";
import type { GuestSession } from "./types";

/* ============================================================
   ゲストセッション（ログイン不要）
   端末にのみ保存するランダムトークンで「同じ端末の再訪」を識別する。
   個人を特定する情報は保持しない。
   ============================================================ */

const SESSION_KEY = "wps.guest.session.v1";
const ADMIN_KEY = "wps.admin.session.v1";
const CONSENT_KEY = "wps.guest.consent.v1";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* プライベートモード等では保存できないが動作は継続する */
  }
}

export function loadGuestSession(): GuestSession | null {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GuestSession;
    if (!parsed.deviceToken || !parsed.eventId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestSession): void {
  safeSet(SESSION_KEY, JSON.stringify(session));
}

export function clearGuestSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

export function hasConsented(version: string = CONSENT_VERSION): boolean {
  return safeGet(CONSENT_KEY) === version;
}

export function markConsented(version: string = CONSENT_VERSION): void {
  safeSet(CONSENT_KEY, version);
}

export function loadAdminSession(): { email: string; role: string } | null {
  const raw = safeGet(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { email: string; role: string };
  } catch {
    return null;
  }
}

export function saveAdminSession(session: { email: string; role: string }): void {
  safeSet(ADMIN_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  try {
    window.localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* noop */
  }
}
