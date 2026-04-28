import { useEffect, useState } from "react";
import { requestJson } from "../../../lib/firebaseApi";
import { fallbackDefaultsOverview, fallbackReferenceData } from "../fallbacks";
import type {
  DashboardResponse,
  DefaultsOverview,
  EntryType,
  ReferenceData,
} from "../types";
import { getMonthKey } from "../utils";

type UseFinanceDataOptions = {
  activeUsername: string | null;
};

export function useFinanceData({ activeUsername }: UseFinanceDataOptions) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [referenceData, setReferenceData] = useState<ReferenceData>(
    fallbackReferenceData,
  );
  const [defaultsOverview, setDefaultsOverview] = useState<DefaultsOverview>(
    fallbackDefaultsOverview,
  );
  const [activeDefaultsTab, setActiveDefaultsTab] =
    useState<EntryType>("expense");
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!activeUsername) {
      setDashboard(null);
      setReferenceData(fallbackReferenceData);
      setDefaultsOverview(fallbackDefaultsOverview);
      setDashboardError(null);
      return;
    }

    const abortController = new AbortController();

    async function loadSupportingData() {
      const [referenceResult, defaultsResult] = await Promise.allSettled([
        requestJson<ReferenceData>(
          "/reference-data",
          { signal: abortController.signal },
          activeUsername,
        ),
        requestJson<DefaultsOverview>(
          "/defaults",
          { signal: abortController.signal },
          activeUsername,
        ),
      ]);

      if (abortController.signal.aborted) {
        return;
      }

      if (referenceResult.status === "fulfilled") {
        setReferenceData(referenceResult.value);
      }

      if (defaultsResult.status === "fulfilled") {
        setDefaultsOverview(defaultsResult.value);
      }
    }

    void loadSupportingData();

    return () => abortController.abort();
  }, [activeUsername, refreshKey]);

  useEffect(() => {
    if (!activeUsername) {
      return;
    }

    const abortController = new AbortController();

    async function loadDashboard() {
      setIsDashboardLoading(true);
      setDashboardError(null);

      try {
        const nextDashboard = await requestJson<DashboardResponse>(
          `/dashboard?month=${selectedMonth}`,
          { signal: abortController.signal },
          activeUsername,
        );
        setDashboard(nextDashboard);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setDashboardError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard right now.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsDashboardLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => abortController.abort();
  }, [activeUsername, refreshKey, selectedMonth]);

  return {
    selectedMonth,
    setSelectedMonth,
    dashboard,
    referenceData,
    defaultsOverview,
    activeDefaultsTab,
    setActiveDefaultsTab,
    isDashboardLoading,
    dashboardError,
    refreshToken: String(refreshKey),
    triggerRefresh() {
      setRefreshKey((current) => current + 1);
    },
    reset() {
      setDashboard(null);
      setReferenceData(fallbackReferenceData);
      setDefaultsOverview(fallbackDefaultsOverview);
      setDashboardError(null);
    },
  };
}
