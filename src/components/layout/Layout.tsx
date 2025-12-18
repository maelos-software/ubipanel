import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Settings, Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { PreferencesProvider } from "./PreferencesProvider";
import { RefreshIndicator } from "../common/RefreshIndicator";
import { NetworkHealth } from "../common/NetworkHealth";
import { ThemeToggle } from "../common/ThemeToggle";
import { SettingsModal } from "../common/SettingsModal";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Scrolls to top of page on route change.
 * Internal helper component used by Layout.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * Settings button component that opens the settings modal.
 */
function SettingsButton() {
  const { openSettings } = usePreferences();

  return (
    <button
      onClick={openSettings}
      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
      aria-label="Open settings"
      title="Settings"
    >
      <Settings className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

/**
 * Mobile hamburger menu button.
 */
function MobileMenuButton() {
  const { isMobile, openMobileSidebar } = useSidebar();

  if (!isMobile) return null;

  return (
    <button
      onClick={openMobileSidebar}
      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

/**
 * Main layout content with sidebar and content area.
 * Adjusts content margin based on sidebar collapsed state.
 * On mobile, sidebar is hidden and content takes full width.
 */
function LayoutContent() {
  const { isCollapsed, isMobile } = useSidebar();

  // On mobile: no margin (sidebar is overlay)
  // On desktop: margin based on collapsed state
  const contentMargin = isMobile ? "" : isCollapsed ? "lg:ml-16" : "lg:ml-64";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <ScrollToTop />
      <SettingsModal />
      <div className={`flex flex-col transition-all duration-300 ${contentMargin}`}>
        <header className="h-14 px-4 sm:px-8 flex items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <MobileMenuButton />
            <NetworkHealth />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <SettingsButton />
            <RefreshIndicator />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * Root layout component for the application.
 * Provides:
 * - Preferences context (theme, refresh interval, density, etc.)
 * - Collapsible sidebar navigation
 * - Sticky header with network health, settings, and refresh indicator
 * - Content area with React Router Outlet
 * - Scroll-to-top on navigation
 *
 * @example
 * ```tsx
 * // In App.tsx routes
 * <Route element={<Layout />}>
 *   <Route path="/" element={<Overview />} />
 *   <Route path="/clients" element={<Clients />} />
 * </Route>
 * ```
 */
export function Layout() {
  return (
    <PreferencesProvider>
      <SidebarProvider>
        <LayoutContent />
      </SidebarProvider>
    </PreferencesProvider>
  );
}
