import { z } from "zod";

/**
 * Internal date-only structural helper.
 *
 * Syntactic `YYYY-MM-DD` plus real calendar-date validation only. Deliberately no
 * date arithmetic, age derivation, timezone handling or range policy.
 */
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (year === undefined || month === undefined || day === undefined) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "must be a valid ISO calendar date in YYYY-MM-DD form");
