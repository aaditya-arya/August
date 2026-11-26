export function validTimezone(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return value; } catch { return null; }
}

/** Convert an explicit local wall time to an instant, including DST offsets. */
export function zonedDateTimeToUtc(value: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validTimezone(timezone)) throw new Error('Invalid local deadline.');
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error('Invalid local deadline.');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (key: string) => parts.find(part => part.type === key)!.value;
    const shown = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
    if (shown === value) return new Date(instant).toISOString();
    instant += target - Date.parse(`${shown}:00Z`);
  }
  throw new Error('This local deadline does not exist in the selected timezone.');
}

export function getRelativeTimeLabel(dateStr: string, now = new Date()): string {
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return "Recently";
  const ms = now.getTime() - date.getTime();
  if (ms < 0) {
    const day = date.toLocaleDateString() === now.toLocaleDateString() ? "Today" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
    return `${day} at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 5) return "Just now";
  if (hours < 1) return `${minutes}m ago`;
  if (days === 0) return `Today (${hours}h ago)`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
