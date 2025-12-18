import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Lazy load pages for code splitting
const Overview = lazy(() => import("@/pages/Overview").then((m) => ({ default: m.Overview })));
const Clients = lazy(() => import("@/pages/Clients").then((m) => ({ default: m.Clients })));
const ClientDetail = lazy(() =>
  import("@/pages/ClientDetail").then((m) => ({ default: m.ClientDetail }))
);
const AccessPoints = lazy(() =>
  import("@/pages/AccessPoints").then((m) => ({ default: m.AccessPoints }))
);
const AccessPointDetail = lazy(() =>
  import("@/pages/AccessPointDetail").then((m) => ({
    default: m.AccessPointDetail,
  }))
);
const Switches = lazy(() => import("@/pages/Switches").then((m) => ({ default: m.Switches })));
const SwitchDetail = lazy(() =>
  import("@/pages/SwitchDetail").then((m) => ({ default: m.SwitchDetail }))
);
const PortDetail = lazy(() =>
  import("@/pages/PortDetail").then((m) => ({ default: m.PortDetail }))
);
const Gateway = lazy(() => import("@/pages/Gateway").then((m) => ({ default: m.Gateway })));
const WANDetail = lazy(() => import("@/pages/WANDetail").then((m) => ({ default: m.WANDetail })));
const Events = lazy(() => import("@/pages/Events").then((m) => ({ default: m.Events })));
const ClientInsights = lazy(() =>
  import("@/pages/ClientInsights").then((m) => ({ default: m.ClientInsights }))
);
const SSIDDetail = lazy(() =>
  import("@/pages/SSIDDetail").then((m) => ({ default: m.SSIDDetail }))
);
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.Reports })));
const BandwidthReport = lazy(() =>
  import("@/pages/reports/BandwidthReport").then((m) => ({ default: m.BandwidthReport }))
);
const ExperienceReport = lazy(() =>
  import("@/pages/reports/ExperienceReport").then((m) => ({ default: m.ExperienceReport }))
);
const RoamingReport = lazy(() =>
  import("@/pages/reports/RoamingReport").then((m) => ({ default: m.RoamingReport }))
);
const APLoadReport = lazy(() =>
  import("@/pages/reports/APLoadReport").then((m) => ({ default: m.APLoadReport }))
);
const WANHealthReport = lazy(() =>
  import("@/pages/reports/WANHealthReport").then((m) => ({ default: m.WANHealthReport }))
);
const PortHealthReport = lazy(() =>
  import("@/pages/reports/PortHealthReport").then((m) => ({ default: m.PortHealthReport }))
);
const InfrastructureReport = lazy(() =>
  import("@/pages/reports/InfrastructureReport").then((m) => ({ default: m.InfrastructureReport }))
);
const GuestReport = lazy(() =>
  import("@/pages/reports/GuestReport").then((m) => ({ default: m.GuestReport }))
);
const RadioReport = lazy(() =>
  import("@/pages/reports/RadioReport").then((m) => ({ default: m.RadioReport }))
);
const Applications = lazy(() =>
  import("@/pages/Applications").then((m) => ({ default: m.Applications }))
);
const ApplicationDetail = lazy(() =>
  import("@/pages/ApplicationDetail").then((m) => ({ default: m.ApplicationDetail }))
);

// Loading spinner for suspense fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 25000,
      retry: 2,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Overview />} />

                {/* Client Routes */}
                <Route path="clients">
                  <Route index element={<Clients />} />
                  <Route path=":mac" element={<ClientDetail />} />
                </Route>

                {/* Infrastructure Routes */}
                <Route path="access-points">
                  <Route index element={<AccessPoints />} />
                  <Route path=":mac" element={<AccessPointDetail />} />
                </Route>

                <Route path="switches">
                  <Route index element={<Switches />} />
                  <Route path=":mac" element={<SwitchDetail />} />
                  <Route path=":swName/port/:portIdx" element={<PortDetail />} />
                </Route>

                <Route path="gateway">
                  <Route index element={<Gateway />} />
                  <Route path="wan/:ifname" element={<WANDetail />} />
                </Route>

                {/* Monitoring & Reporting Routes */}
                <Route path="events" element={<Events />} />
                <Route path="insights" element={<ClientInsights />} />
                <Route path="ssid/:essid" element={<SSIDDetail />} />

                <Route path="reports">
                  <Route index element={<Reports />} />
                  <Route path="bandwidth" element={<BandwidthReport />} />
                  <Route path="experience" element={<ExperienceReport />} />
                  <Route path="roaming" element={<RoamingReport />} />
                  <Route path="ap-load" element={<APLoadReport />} />
                  <Route path="wan-health" element={<WANHealthReport />} />
                  <Route path="port-health" element={<PortHealthReport />} />
                  <Route path="infrastructure" element={<InfrastructureReport />} />
                  <Route path="guest" element={<GuestReport />} />
                  <Route path="radio" element={<RadioReport />} />
                </Route>

                {/* Application Routes */}
                <Route path="applications">
                  <Route index element={<Applications />} />
                  <Route path=":appId" element={<ApplicationDetail />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
