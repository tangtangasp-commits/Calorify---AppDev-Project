import { API_BASE } from './config';

export async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { error: e.error || `Error ${res.status}` };
    }
    return res.json();
  } catch (e) {
    return { error: 'Cannot reach server. Is Flask running?' };
  }
}

/** Returns today's date as YYYY-MM-DD in LOCAL timezone (not UTC). */
export function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns YYYY-MM-DD for any Date object, in local timezone. */
export function getLocalDateFrom(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

/** Human-friendly label for a YYYY-MM-DD string. */
export function fmtDateLabel(dateStr) {
  const today = getLocalDate();
  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const yesterday = getLocalDateFrom(yd);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
