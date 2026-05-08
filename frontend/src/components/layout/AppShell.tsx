import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { IconMenu } from "@/dashboard/DashboardIcons";
import { Sidebar, SIDEBAR_WIDTH_PX } from "@/dashboard/Sidebar";
import { logoUrl, navItems } from "./appShellData";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  const isDashboardHome = location.pathname === "/";

  const mainChromeClass = cn(
    "flex min-h-0 flex-1 flex-col",
    isDashboardHome ? "overflow-hidden" : "overflow-y-auto",
    /* Dashboard is a fixed viewport layout — less bottom padding so content doesn’t float above a huge empty gap */
    isDashboardHome
      ? sidebarOpen
        ? "pt-2 ps-4 pb-4 md:ps-6 md:pb-5 scroll-pb-6"
        : "pt-12 ps-11 pb-4 md:ps-[3.25rem] md:pb-6 scroll-pb-6"
      : sidebarOpen
        ? "pt-2 ps-4 pb-12 md:ps-6 md:pb-16 scroll-pb-16"
        : "pt-12 ps-11 pb-12 md:ps-[3.25rem] md:pb-16 scroll-pb-16",
  );

  return (
    <div className="flex h-screen overflow-hidden font-['Inter',_sans-serif]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={navItems}
        logoUrl={logoUrl}
      />

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-2 z-[60] flex h-10 w-10 items-center justify-center rounded-lg text-[#4B5563] transition-colors duration-200 hover:text-[#374151] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/35"
          aria-label="Open navigation menu"
          aria-expanded={false}
          aria-controls="medflow-sidebar"
        >
          <IconMenu />
        </button>
      )}

      <div
        className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden medflow-page-bg transition-[margin-left] duration-400 ease-medflow"
        style={{ marginLeft: sidebarOpen ? SIDEBAR_WIDTH_PX : 0 }}
      >
        <main
          className={mainChromeClass}
        >
          <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
