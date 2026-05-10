/**
 * Client-side mirror of backend scheduling: two visits conflict if their time
 * ranges share any minute (back-to-back is OK).
 */
function minutesFromTime(time: string): number {
  const [h = "0", m = "0"] = String(time).trim().split(":");
  return Number(h) * 60 + Number(m);
}

function durationMinutes(d: number | undefined): number {
  return Number(d) > 0 ? Number(d) : 30;
}

function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0;
}

export type AppointmentLikeForDedupe = {
  id: string;
  date: string;
  timeRaw: string;
  durationMinutes?: number;
  /** When present, overlaps resolve by keeping the earliest document (matches API cleanup). */
  createdAt?: string;
};

/**
 * Per calendar day, keeps non-overlapping visits only (earliest time first,
 * then stable id). Use after loading from the API so legacy duplicates do not
 * stack in the UI before DB cleanup runs.
 */
export function dedupeOverlappingAppointments<T extends AppointmentLikeForDedupe>(items: T[]): T[] {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }

  const out: T[] = [];
  for (const [, dayList] of byDate) {
    const sorted = [...dayList].sort((a, b) => {
      const da = minutesFromTime(a.timeRaw);
      const db = minutesFromTime(b.timeRaw);
      if (da !== db) return da - db;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

    const kept: T[] = [];
    for (const cand of sorted) {
      const cs = minutesFromTime(cand.timeRaw);
      const ce = cs + durationMinutes(cand.durationMinutes);
      const clashes = kept.some((k) => {
        const ks = minutesFromTime(k.timeRaw);
        const ke = ks + durationMinutes(k.durationMinutes);
        return intervalsOverlap(cs, ce, ks, ke);
      });
      if (!clashes) kept.push(cand);
    }
    out.push(...kept);
  }

  return out;
}
