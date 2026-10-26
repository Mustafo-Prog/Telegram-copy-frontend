// Calendar boundaries use the viewer's local timezone, including daylight saving changes.
export function lastSeenDescription(value, now = new Date()) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  if (elapsed < 60_000) return { key: 'presence.justNow' };
  if (elapsed < 3_600_000) return { key: 'presence.minutesAgo', count: Math.floor(elapsed / 60_000) };
  if (date.toDateString() === now.toDateString()) return { key: 'presence.today', date };
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return { key: date.toDateString() === yesterday.toDateString() ? 'presence.yesterday' : 'presence.date', date };
}
