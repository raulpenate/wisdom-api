declare const dayBrand: unique symbol;

export type Day = string & { readonly [dayBrand]: true };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;

export function utcDay(date: Date): Day {
  return date.toISOString().slice(0, 10) as Day;
}

export function addDays(day: Day, days: number): Day {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

export function servedDays(now: Date): readonly Day[] {
  const today = utcDay(now);
  return [addDays(today, -1), today, addDays(today, 1)];
}

export function parseDay(raw: string | undefined, now: Date): Day | null {
  if (raw === undefined) return utcDay(now);
  if (!DAY_PATTERN.test(raw)) return null;
  return servedDays(now).includes(raw as Day) ? (raw as Day) : null;
}
