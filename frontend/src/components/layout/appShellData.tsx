import {
  IconAppointments,
  IconDashboard,
  IconNotes,
  IconPatients,
  IconSettings,
} from "@/dashboard/DashboardIcons";
import type { NavItem } from "@/dashboard/types";

export const logoUrl = "/Medflow.png";

export const navItems: NavItem[] = [
  { icon: IconDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: IconPatients, label: "Patients", path: "/patients" },
  { icon: IconAppointments, label: "Appointments", path: "/appointments" },
  { icon: IconNotes, label: "Notes", path: "/notes" },
  { icon: IconSettings, label: "Settings", path: "/settings" },
];
