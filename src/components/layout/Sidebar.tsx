import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Laptop,
  Wifi,
  Network,
  Router,
  Bell,
  BarChart3,
  FileText,
  Globe,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useConfig } from "@/lib/config";
import { useSidebar } from "./SidebarContext";
import { useHasTrafficData } from "@/hooks/useTrafficData";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Clients",
    items: [
      { to: "/clients", icon: Laptop, label: "All Clients" },
      { to: "/insights", icon: BarChart3, label: "Insights" },
      { to: "/applications", icon: Globe, label: "Applications" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { to: "/access-points", icon: Wifi, label: "Access Points" },
      { to: "/switches", icon: Network, label: "Switches" },
      { to: "/gateway", icon: Router, label: "Gateway" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { to: "/events", icon: Bell, label: "Events" },
      { to: "/reports", icon: FileText, label: "Reports" },
    ],
  },
];

export function Sidebar() {
  const { data: config } = useConfig();
  const { isCollapsed, toggleSidebar, isMobile, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { hasData: hasTrafficData, isLoading: trafficLoading } = useHasTrafficData();
  const location = useLocation();

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      closeMobileSidebar();
    }
    // Only trigger on location change, not on other dependency changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // On mobile: hidden by default, shown as overlay when isMobileOpen
  // On desktop: always visible, can be collapsed
  const sidebarClasses = isMobile
    ? `fixed top-0 left-0 h-screen sidebar-gradient flex flex-col z-50 transition-transform duration-300 w-64 ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`
    : `fixed top-0 left-0 h-screen sidebar-gradient flex flex-col z-40 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarClasses}>
        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={closeMobileSidebar}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:ring-2 focus-visible:ring-white outline-none"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        {/* Toggle Button - desktop only */}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-20 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
        {/* Logo */}
        <div className={`p-4 ${!isMobile && isCollapsed ? "px-3" : "p-6"}`}>
          <div
            className={`flex items-center ${!isMobile && isCollapsed ? "justify-center" : "gap-3"}`}
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            {(isMobile || !isCollapsed) && (
              <span className="text-xl font-bold text-white font-[var(--font-display)] tracking-tight">
                UbiPanel
              </span>
            )}
          </div>
        </div>
        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <div className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                {(isMobile || !isCollapsed) && (
                  <div className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {group.label}
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map(({ to, icon: Icon, label }) => {
                    // Show "Optional" badge for Applications when collector isn't running
                    const showOptionalBadge =
                      to === "/applications" && !trafficLoading && !hasTrafficData;
                    const showCollapsed = !isMobile && isCollapsed;

                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        title={
                          showCollapsed
                            ? showOptionalBadge
                              ? `${label} (Optional)`
                              : label
                            : undefined
                        }
                        className={({ isActive }) =>
                          `relative flex items-center rounded-lg transition-all ${
                            showCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5"
                          } ${
                            isActive
                              ? "bg-white/10 text-white font-semibold"
                              : "text-white/70 hover:text-white hover:bg-white/5"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && !showCollapsed && (
                              <div className="absolute left-0 w-0.5 h-5 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                            )}
                            <Icon
                              className={`w-5 h-5 shrink-0 ${isActive ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" : ""}`}
                            />
                            {!showCollapsed && (
                              <span className="flex items-center gap-2">
                                {label}
                                {showOptionalBadge && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase tracking-wide">
                                    Optional
                                  </span>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
        {/* Footer */}
        {(isMobile || !isCollapsed) && (
          <div className="p-4 border-t border-white/10">
            <div className="px-4 py-2 rounded-lg bg-black/20">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
                Connected to
              </div>
              <div className="text-sm text-white font-medium">
                {config?.siteName ?? "Loading..."}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
