import { IconClock } from "./DashboardIcons";
import type { AppointmentStatus } from "./types";

type AppointmentCardProps = {
  initials: string;
  avatarBg: string;
  initialsColor: string;
  name: string;
  time: string;
  visit: string;
  status: AppointmentStatus;
};

const statusStyles: Record<AppointmentStatus, { label: string; badge: string; border: string }> = {
  upcoming: {
    label: "Upcoming",
    badge: "bg-[#E3EAE3] text-[#3C4A42]",
    border: "border-[#E5E7EB]",
  },
  "in-progress": {
    label: "In Progress",
    badge: "bg-[#047857] text-white",
    border: "border-[#047857]",
  },
  completed: {
    label: "Completed",
    badge: "bg-[rgba(4,120,87,0.12)] text-[#065f46]",
    border: "border-[#E5E7EB]",
  },
};

export function AppointmentCard({
  initials,
  avatarBg,
  initialsColor,
  name,
  time,
  visit,
  status,
}: AppointmentCardProps) {
  const { label, badge, border } = statusStyles[status];
  const faded = status === "completed" ? "opacity-70" : "";

  return (
    <div
      className={`bg-white rounded-xl border ${border} shadow-sm ${faded} flex items-center justify-between px-[17px] py-[17px] gap-3 min-h-[82px]`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className={`w-12 h-12 rounded flex items-center justify-center flex-shrink-0 ${avatarBg}`}
        >
          <span className={`text-base font-bold ${initialsColor}`}>{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#161D19] text-[18px] leading-[27px]">{name}</p>
          <div className="flex items-center gap-1 mt-0">
            <span className="text-[#3C4A42] flex-shrink-0">
              <IconClock />
            </span>
            <span className="text-[#3C4A42] text-[14px] leading-5 truncate">
              {time} — {visit}
            </span>
          </div>
        </div>
      </div>
      <span className={`text-[12px] font-medium leading-4 px-2 py-1 rounded-sm flex-shrink-0 whitespace-nowrap ${badge}`}>
        {label}
      </span>
    </div>
  );
}
