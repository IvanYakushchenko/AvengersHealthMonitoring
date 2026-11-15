import { useCallback, useEffect, useState } from 'react';
import {
  authApi,
  isUnauthorized,
  type HealthSource,
  type IndicatorInfo,
  type Reading,
  type StatusResult,
} from '../../../api/healthApi';
import { BACKEND_INDICATOR_IDS } from '../data/indicatorBindings';

// Everything the page shows at one moment: the ratings, the newest reading of each indicator, and the streak and points.
export interface HealthSnapshot {
  // Newest rating per backend indicator id.
  statuses: Record<string, StatusResult>;
  // Newest saved reading per indicator id (only indicators that have one).
  latestReadings: Record<string, Reading>;
  streak: number;
  points: number;
}

// Loads what the indications page shows for one source (the crew member or one crew member
// seen by mission control). Call refresh() after every change.
export function useHealthData(source: HealthSource, onSessionExpired: () => void) {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [rules, setRules] = useState<Record<string, IndicatorInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [overview, checklist, histories] = await Promise.all([
        source.getStatus(),
        source.getChecklist(),
        Promise.all(BACKEND_INDICATOR_IDS.map((id) => source.getReadings(id))),
      ]);

      const statuses: Record<string, StatusResult> = {};
      overview.regions.forEach((region) =>
        region.indicators.forEach((result) => {
          statuses[result.indicatorId] = result;
        }),
      );

      // Readings come oldest first, so the last one is the newest.
      const latestReadings: Record<string, Reading> = {};
      BACKEND_INDICATOR_IDS.forEach((id, index) => {
        const history = histories[index];
        if (history.length > 0) latestReadings[id] = history[history.length - 1];
      });

      setSnapshot({
        statuses,
        latestReadings,
        streak: checklist.streak,
        points: checklist.points,
      });
      setError(null);
    } catch (err) {
      if (isUnauthorized(err)) {
        onSessionExpired();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [source, onSessionExpired]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The allowed ranges and optional values come from the backend, once.
  useEffect(() => {
    authApi
      .getIndicators()
      .then((list) => setRules(Object.fromEntries(list.map((info) => [info.indicatorId, info]))))
      .catch(() => undefined);
  }, []);

  return { snapshot, rules, error, loading, refresh };
}
