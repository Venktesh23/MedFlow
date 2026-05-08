import type { ReactNode } from "react";

export type AppointmentStatus = "upcoming" | "in-progress" | "completed";

export type NavItem = {
  icon: () => ReactNode;
  label: string;
  path: string;
};

export type StatCardData = {
  iconBg: string;
  icon: ReactNode;
  label: string;
  value: string | number;
};

export type Appointment = {
  initials: string;
  avatarBg: string;
  initialsColor: string;
  name: string;
  time: string;
  visit: string;
  status: AppointmentStatus;
};

export type PatientNote = {
  /** Mongo note id — links to Notes tab when set */
  noteId?: string;
  /** ISO timestamp — used on dashboard to sort notes */
  createdAt?: string;
  patient: string;
  visitType: string;
  timeAgo: string;
  excerpt: string;
  tags: string[];
  highlighted?: boolean;
};

export type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};
