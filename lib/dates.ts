import { format, isSameDay, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { tz } from "@date-fns/tz";

// Dates and times are always shown in Belgian time. Pages render on the server
// in UTC and hydrate in the visitor's browser; formatting in either's own
// timezone shows the wrong time and, between 22:00 and 24:00 UTC, makes the
// two disagree on what "today" is, which breaks hydration (#142).
const inBrussels = tz("Europe/Brussels");

type DateInput = Date | string | number;

/** Formats a date with a date-fns pattern, in Dutch and Belgian time. */
export function formatDate(date: DateInput, pattern: string): string {
  return format(new Date(date), pattern, { locale: nl, in: inBrussels });
}

/** True when both moments fall on the same Belgian calendar day. */
export function isSameBelgianDay(a: DateInput, b: DateInput): boolean {
  return isSameDay(new Date(a), new Date(b), { in: inBrussels });
}

/** "Vandaag", "Gisteren" or "17 oktober 2026", in Belgian time. */
export function dayLabel(date: DateInput, now: DateInput = new Date()): string {
  if (isSameBelgianDay(date, now)) return "Vandaag";
  if (isSameBelgianDay(date, subDays(new Date(now), 1))) return "Gisteren";
  return formatDate(date, "d MMMM yyyy");
}
