import {
  IconAppointments,
  IconDashboard,
  IconNotes,
  IconPatients,
  IconSettings,
} from "@/dashboard/DashboardIcons";
import type { NavItem } from "@/dashboard/types";

export const logoUrl =
  "https://api.builder.io/api/v1/image/assets/TEMP/0d738fa6203e06571705364cc028ca9146460e41?width=314";

export const navItems: NavItem[] = [
  { icon: IconDashboard, label: "Dashboard", path: "/" },
  { icon: IconPatients, label: "Patients", path: "/patients" },
  { icon: IconAppointments, label: "Appointments", path: "/appointments" },
  { icon: IconNotes, label: "Notes", path: "/notes" },
  { icon: IconSettings, label: "Settings", path: "/settings" },
];
