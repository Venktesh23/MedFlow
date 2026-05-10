import { ChevronLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { NavItem } from "./types";

/** Must match main column push margin in `AppShell`. */
export const SIDEBAR_WIDTH_PX = 240;

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  logoUrl: string;
};

export function Sidebar({ isOpen, onClose, navItems, logoUrl }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <aside
      id="medflow-sidebar"
      className={`
          fixed inset-y-0 left-0 z-40
          w-[240px] h-screen flex flex-col flex-shrink-0 overflow-hidden
          rounded-r-2xl
          bg-[#1E2A38] shadow-2xl shadow-black/30
          transition-transform duration-400 ease-medflow
          ${isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"}
        `}
      aria-hidden={!isOpen}
    >
        <div className="grid h-[92px] flex-shrink-0 grid-cols-[1fr_auto_1fr] items-center px-3">
          <div className="flex min-w-0 justify-end">
            {isOpen && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 translate-x-2 items-center justify-center rounded-lg text-white transition-colors duration-200 hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Close navigation menu"
                aria-expanded={true}
                aria-controls="medflow-sidebar"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          <Link
            to="/"
            onClick={onClose}
            className="flex min-h-0 shrink-0 items-center justify-center overflow-hidden px-1 py-2 transition-opacity duration-200"
          >
            <img src={logoUrl} alt="MedFlow" className="h-auto w-[156px] object-contain" />
          </Link>
          <div className="min-w-0 shrink-0" aria-hidden />
        </div>

        <nav className="flex flex-col gap-1 px-2 mt-0 flex-1 overflow-y-auto">
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = path === "/" ? pathname === path : pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={`
                  flex items-center gap-4 px-4 py-3.5 rounded-xl border
                  transition-all duration-200 ease-medflow
                  active:scale-[0.98]
                  ${
                    active
                      ? "border-white/35 bg-white/20 text-white shadow-md shadow-black/20 ring-1 ring-inset ring-white/15"
                      : "border-transparent text-[#C1C6D7] hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                  }
                `}
              >
                <span className="text-inherit">
                  <Icon />
                </span>
                <span className="text-base leading-6 text-inherit">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[rgba(187,202,191,0.10)] px-4 py-5 mt-auto">
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
              navigate("/login", { replace: true });
            }}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/[0.12] active:scale-[0.98]"
          >
            Log out
          </button>
        </div>
    </aside>
  );
}
