/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env files: .env, .env.development, .env.[mode]
  const env = loadEnv(mode, process.cwd(), "");

  const proxyPort = env.DEV_PROXY_PORT || "4821";
  const apiUrl = env.VITE_API_URL || `http://localhost:${proxyPort}`;

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: parseInt(env.DEV_VITE_PORT || "4820"),
      strictPort: true,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      // Use jsdom for component tests, node for unit tests
      environment: "jsdom",
      include: ["tests/**/*.test.{ts,tsx}", "collector/tests/**/*.test.js"],
      setupFiles: ["./tests/setup.tsx"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: [
          // Core business logic - should have high coverage
          "src/lib/**/*.ts",
          // Reusable chart components
          "src/components/charts/**/*.tsx",
          // Reusable UI components
          "src/components/common/**/*.tsx",
          // History hooks with data transformation logic
          "src/hooks/history/**/*.ts",
          // Utility hooks
          "src/hooks/useSortableData.ts",
          "src/hooks/useChartColors.ts",
          "src/hooks/useTheme.ts",
          // Server-side validation
          "server/lib/**/*.js",
          // Collector logic
          "collector/lib/**/*.js",
        ],
        exclude: [
          // Layout components - tested via E2E
          "src/components/layout/**",
          // Page components - tested via E2E
          "src/pages/**",
          // React context - tested implicitly
          "src/lib/preferencesContext.ts",
          // Complex UI components better suited for E2E
          "src/components/common/NetworkHealth.tsx",
          "src/components/common/PortTooltip.tsx",
          "src/components/common/RefreshIndicator.tsx",
          "src/components/common/ErrorBoundary.tsx",
          "src/components/common/SortableHeader.tsx",
          "src/components/common/ThemeToggle.tsx",
          // Data-fetching hooks - thin wrappers around TanStack Query, tested via E2E
          "src/hooks/useClients.ts",
          "src/hooks/useAccessPoints.ts",
          "src/hooks/useSwitches.ts",
          "src/hooks/useGateway.ts",
          "src/hooks/useNetworkData.ts",
          "src/hooks/useBandwidth.ts",
          "src/hooks/useSSID.ts",
          "src/hooks/useTrafficData.ts",
          "src/hooks/useInfluxQuery.ts",
          "src/hooks/useHistoricalData.ts",
          "src/hooks/usePreferences.ts",
          "src/hooks/useRefreshInterval.ts",
          "src/hooks/useDefaultTimeRange.ts",
          "src/hooks/useTimeRangeState.ts",
          // Re-export index files
          "src/hooks/history/index.ts",
          // App entry points
          "src/App.tsx",
          "src/main.tsx",
        ],
      },
    },
  };
});
