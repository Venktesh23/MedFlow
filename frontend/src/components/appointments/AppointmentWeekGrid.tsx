import { useMemo } from "react";
import { Link } from "react-router-dom";

export type WeekGridAppointment = {
  id: string;
  date: string;
  timeRaw: string;
  durationMinutes: number;
  name: string;
  type: string;
  status: "upcoming" | "in-progress" | "completed";
  initials: string;
  avatarBg: string;
  avatarColor: string;
  labelTime: string;
  period: string;
};

/** Vertical pixels per hour — larger = more space between hour lines and taller event blocks. */
const PX_PER_HOUR = 96;
/** Ensures short visits still show full patient name + visit type with wrapping. */
const MIN_EVENT_HEIGHT_PX = 96;
/** Minimum width for the whole week strip so each day column can fit long names. */
const WEEK_GRID_MIN_WIDTH_PX = 1240;

const DEFAULT_GRID_START = 6;
const DEFAULT_GRID_END_INCLUSIVE = 21;

/**
 * `clinicHoursEnd` is inclusive (last hour row, e.g. 17 = 5 PM block).
 * Grid uses exclusive end hour for layout (next hour after last visible slot).
 */
export function normalizeGridHours(
  clinicHoursStart?: number,
  clinicHoursEndInclusive?: number,
): { startHour: number; endExclusive: number } {
  let s =
    typeof clinicHoursStart === "number" && Number.isFinite(clinicHoursStart)
      ? Math.round(clinicHoursStart)
      : DEFAULT_GRID_START;
  let eInc =
    typeof clinicHoursEndInclusive === "number" && Number.isFinite(clinicHoursEndInclusive)
      ? Math.round(clinicHoursEndInclusive)
      : DEFAULT_GRID_END_INCLUSIVE;
  s = Math.min(23, Math.max(0, s));
  eInc = Math.min(23, Math.max(0, eInc));
  if (eInc < s) {
    const swap = s;
    s = eInc;
    eInc = swap;
  }
  const endExclusive = Math.min(24, eInc + 1);
  if (endExclusive <= s) {
    return { startHour: DEFAULT_GRID_START, endExclusive: 22 };
  }
  return { startHour: s, endExclusive };
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHourLabel(hour24: number): string {
  const h = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${h} ${suffix}`;
}

function statusBorder(status: WeekGridAppointment["status"]) {
  if (status === "completed") return "border-[#1E2A38]/80 bg-[rgba(30,42,56,0.12)]";
  if (status === "in-progress") return "border-[#1E2A38] bg-[#1E2A38] text-white";
  return "border-[#1E2A38]/40 bg-[rgba(30,42,56,0.08)]";
}

function statusTextClass(status: WeekGridAppointment["status"]) {
  if (status === "in-progress") return "text-white";
  return "text-[#161D19]";
}

/** Human-readable visit type / reason (API uses kebab-case like annual-physical). */
function formatVisitLabel(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return "Visit";
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

type AppointmentWeekGridProps = {
  weekStart: Date;
  appointments: WeekGridAppointment[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  /** Inclusive hours (0–23); from Settings → Clinic. Defaults: 6–21 (same visible span as before). */
  clinicHoursStart?: number;
  clinicHoursEnd?: number;
};

export function AppointmentWeekGrid({
  weekStart,
  appointments,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  clinicHoursStart,
  clinicHoursEnd,
}: AppointmentWeekGridProps) {
  const { startHour, endExclusive, totalMinutes, gridHeightPx, hours } = useMemo(() => {
    const { startHour: sh, endExclusive: ee } = normalizeGridHours(clinicHoursStart, clinicHoursEnd);
    const span = ee - sh;
    return {
      startHour: sh,
      endExclusive: ee,
      totalMinutes: span * 60,
      gridHeightPx: span * PX_PER_HOUR,
      hours: Array.from({ length: span }, (_, i) => sh + i),
    };
  }, [clinicHoursStart, clinicHoursEnd]);

  function parseTimeToMinutes(t: string): number {
    const parts = t.trim().split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1] ?? 0);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return startHour * 60;
    return hour * 60 + minute;
  }

  const lastShownHour = endExclusive - 1;

  const dayMetas = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: d,
      ymd: localYmd(d),
      weekdayShort: d.toLocaleDateString("en-US", { weekday: "short" }),
      monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isToday: localYmd(d) === localYmd(new Date()),
    };
  });

  const rangeLabel = `${dayMetas[0].monthDay} – ${dayMetas[6].monthDay}, ${dayMetas[0].date.getFullYear()}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold text-[#1E2939]">{rangeLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onThisWeek}
            className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#FAFAFA]"
          >
            Today
          </button>
          <div className="flex items-center rounded-lg border border-[#E5E7EB] bg-white">
            <button
              type="button"
              onClick={onPrevWeek}
              className="px-2.5 py-1.5 text-sm text-[#1E2A38] hover:bg-[rgba(30,42,56,0.06)]"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              className="px-2.5 py-1.5 text-sm text-[#1E2A38] hover:bg-[rgba(30,42,56,0.06)]"
              aria-label="Next week"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div style={{ minWidth: WEEK_GRID_MIN_WIDTH_PX }}>
          {/* Day headers */}
          <div className="grid border-b border-[#E5E7EB] bg-[#FAFAFA]" style={{ gridTemplateColumns: `64px repeat(7, minmax(0, 1fr))` }}>
            <div className="border-r border-[#E5E7EB]" />
            {dayMetas.map((dm) => (
              <div
                key={dm.ymd}
                className={`px-2 py-3 text-center ${dm.isToday ? "bg-[rgba(30,42,56,0.08)]" : ""}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{dm.weekdayShort}</p>
                <p className={`text-lg font-bold ${dm.isToday ? "text-[#1E2A38]" : "text-[#1E2939]"}`}>
                  {dm.date.getDate()}
                </p>
              </div>
            ))}
          </div>

          <div className="flex max-h-[min(72vh,780px)] overflow-y-auto overscroll-contain">
            {/* Time gutter */}
            <div className="w-16 shrink-0 border-r border-[#F3F4F6] bg-white pt-0">
              {hours.map((h) => (
                <div
                  key={h}
                  className="box-border flex justify-end pr-2 pt-0 text-[11px] font-medium leading-none text-[#9CA3AF]"
                  style={{ height: PX_PER_HOUR }}
                >
                  <span className="-translate-y-2.5">{formatHourLabel(h)}</span>
                </div>
              ))}
            </div>

            {/* 7 columns */}
            <div className="grid min-w-0 flex-1 grid-cols-7 divide-x divide-[#F3F4F6]">
              {dayMetas.map((dm) => {
                const dayAppts = appointments.filter((a) => a.date === dm.ymd);

                return (
                  <div key={dm.ymd} className="relative bg-white" style={{ minHeight: gridHeightPx }}>
                    {/* hour lines */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col">
                      {hours.map((h) => (
                        <div key={h} className="box-border border-b border-[#F3F4F6]" style={{ height: PX_PER_HOUR }} />
                      ))}
                    </div>

                    {/* events */}
                    {dayAppts.map((a) => {
                      const startMin = parseTimeToMinutes(a.timeRaw);
                      const dur = Math.max(15, a.durationMinutes || 30);
                      let topMin = startMin - startHour * 60;
                      let visDur = dur;
                      if (topMin + dur > totalMinutes) {
                        visDur = Math.max(15, totalMinutes - Math.max(0, topMin));
                      }
                      if (topMin >= totalMinutes) return null;
                      if (topMin < 0) {
                        visDur = Math.max(15, visDur + topMin);
                        topMin = 0;
                      }
                      if (visDur <= 0) return null;

                      const topPx = (topMin / totalMinutes) * gridHeightPx;
                      const durationHeightPx = (visDur / totalMinutes) * gridHeightPx;
                      const heightPx = Math.max(MIN_EVENT_HEIGHT_PX, durationHeightPx);

                      return (
                        <Link
                          key={a.id}
                          to={`/session/${a.id}`}
                          className={`absolute left-1 right-1 z-10 flex flex-col rounded-lg border px-2 py-2 text-left shadow-sm transition-opacity hover:opacity-95 box-border ${statusBorder(a.status)}`}
                          style={{
                            top: topPx,
                            height: heightPx,
                          }}
                          title={`${a.name} · ${formatVisitLabel(a.type)}`}
                        >
                          <p
                            className={`shrink-0 text-[11px] font-semibold tabular-nums leading-none opacity-90 ${statusTextClass(a.status)}`}
                          >
                            {a.labelTime}
                            <span className={`font-normal opacity-80 ${a.status === "in-progress" ? "text-white/85" : ""}`}>
                              {" "}
                              {a.period}
                            </span>
                          </p>
                          <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                            <p
                              className={`break-words text-[13px] font-semibold leading-snug hyphens-auto [overflow-wrap:anywhere] ${statusTextClass(a.status)}`}
                            >
                              {a.name}
                            </p>
                            <p
                              className={`break-words text-[12px] font-medium leading-snug [overflow-wrap:anywhere] ${a.status === "in-progress" ? "text-white/95" : "text-[#4B5563]"}`}
                            >
                              {formatVisitLabel(a.type)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="px-1 text-xs text-[#6B7280]">
        Week starts Sunday. Hours match your clinic settings ({formatHourLabel(startHour)}–
        {formatHourLabel(lastShownHour)}).
      </p>
    </div>
  );
}
