import { parse } from 'chrono-node';
import type { ParsedResult } from 'chrono-node';

const BOOKING_VERBS =
  /(book|books|booked|booking|schedule|scheduled?|reserv|slot|appointment|calendar|meet(ing)?|put me|register|confirm)\b/i;
const AVOID_PURE_CALLBACK =
  /(call (me )?back(?! (later|tomorrow|next))|ring me|phone me(?! for))/i;

/**
 * Heuristic: the caller wants a calendar slot (not just a human callback with no time).
 */
export function hasAdHocBookingIntent(text: string): boolean {
  if (!text?.trim()) return false;
  if (AVOID_PURE_CALLBACK.test(text) && !/\b(at|on|for|by)\s+\d|\d{1,2}\s*[:.]\s*\d{2}|\b(am|pm|ist|tomorrow|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february)/i.test(text)) {
    return false;
  }
  return BOOKING_VERBS.test(text);
}

export type AdHocParsedWindow = { start: Date; end: Date; confidence: 'chrono' | 'inferred' };

/**
 * Try to read a start (and optional end) instant from a voice summary and/or transcript.
 * Uses the current time as a reference; prefers forward-dated times.
 */
export function parseAdHocSlotFromText(
  text: string,
  referenceDate: Date = new Date(),
  defaultDurationMin: number,
): AdHocParsedWindow | null {
  const t = (text || '').replace(/\r/g, '').trim();
  if (!t) return null;
  if (!hasAdHocBookingIntent(t)) return null;

  const results = parse(t, referenceDate, { forwardDate: true });
  if (results.length === 0) {
    // ISO or Indian-style light fallback: narrow substring that looks date-like
    const m = t.match(
      /(\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)/i,
    );
    if (m) {
      const r2 = parse(
        t.slice(t.indexOf(m[0])),
        referenceDate,
        { forwardDate: true },
      );
      if (r2.length) {
        const start0 = r2[0].start.date();
        if (start0 && !isNaN(start0.getTime())) {
          return finishWindow(
            new Date(start0.getTime()),
            r2[0].end,
            defaultDurationMin,
            'inferred',
          );
        }
      }
    }
    return null;
  }

  const first: ParsedResult = results[0];
  const start = first.start.date();
  if (isNaN(start.getTime())) return null;

  return finishWindow(new Date(start.getTime()), first.end, defaultDurationMin, 'chrono');
}

function finishWindow(
  start: Date,
  chronoEnd: ParsedResult['end'],
  defaultDurationMin: number,
  confidence: 'chrono' | 'inferred',
): AdHocParsedWindow {
  if (chronoEnd) {
    const e = chronoEnd.date();
    if (e && !isNaN(e.getTime()) && e.getTime() > start.getTime()) {
      return { start, end: e, confidence };
    }
  }
  return {
    start,
    end: new Date(start.getTime() + defaultDurationMin * 60_000),
    confidence,
  };
}

/**
 * @internal tests — export for future unit tests
 */
export function isFutureEnough(start: Date, minBufferMin = 5): boolean {
  return start.getTime() - Date.now() > minBufferMin * 60_000;
}
