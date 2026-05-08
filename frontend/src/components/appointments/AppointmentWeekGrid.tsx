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
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const GRID_HEIGHT_PX = (END_HOUR - START_HOUR) * PX_PER_HOUR;
/** Ensures short visits still show full patient name + visit type with wrapping. */
const MIN_EVENT_HEIGHT_PX = 96;
/** Minimum width for the whole week strip so each day column can fit long names. */
const WEEK_GRID_MIN_WIDTH_PX = 1240;

function parseTimeToMinutes(t: string): number {
  const parts = t.trim().split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return START_HOUR * 60;
  return hour * 60 + minute;
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
  if (status === "completed") return "border-[#047857]/80 bg-[rgba(4,120,87,0.12)]";
  if (status === "in-progress") return "border-[#047857] bg-[#047857] text-white";
  return "border-[#047857]/40 bg-[rgba(4,120,87,0.08)]";
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
};

export function AppointmentWeekGrid({
  weekStart,
  appointments,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
}: AppointmentWeekGridProps) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

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
              className="px-2.5 py-1.5 text-sm text-[#047857] hover:bg-[rgba(4,120,87,0.06)]"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              className="px-2.5 py-1.5 text-sm text-[#047857] hover:bg-[rgba(4,120,87,0.06)]"
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
                className={`px-2 py-3 text-center ${dm.isToday ? "bg-[rgba(4,120,87,0.08)]" : ""}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{dm.weekdayShort}</p>
                <p className={`text-lg font-bold ${dm.isToday ? "text-[#047857]" : "text-[#1E2939]"}`}>
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
                  <div key={dm.ymd} className="relative bg-white" style={{ minHeight: GRID_HEIGHT_PX }}>
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
                      let topMin = startMin - START_HOUR * 60;
                      let visDur = dur;
                      if (topMin + dur > TOTAL_MINUTES) {
                        visDur = Math.max(15, TOTAL_MINUTES - Math.max(0, topMin));
                      }
                      if (topMin >= TOTAL_MINUTES) return null;
                      if (topMin < 0) {
                        visDur = Math.max(15, visDur + topMin);
                        topMin = 0;
                      }
                      if (visDur <= 0) return null;

                      const topPx = (topMin / TOTAL_MINUTES) * GRID_HEIGHT_PX;
                      const durationHeightPx = (visDur / TOTAL_MINUTES) * GRID_HEIGHT_PX;
                      const heightPx = Math.max(MIN_EVENT_HEIGHT_PX, durationHeightPx);

                      return (
                        <Link
                          key={a.id}
                          to={`/session/${a.id}`}
                          className={`absolute left-1 right-1 z-10 flex flex-col rounded-lg border px-2.5 py-2 text-left shadow-sm transition-opacity hover:opacity-95 ${statusBorder(a.status)}`}
                          style={{ top: topPx, height: heightPx }}
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
        Week starts Sunday (same as Google Calendar US). Scroll vertically for earlier and later hours ({START_HOUR}:00–
        {END_HOUR}:00).
      </p>
    </div>
  );
}
