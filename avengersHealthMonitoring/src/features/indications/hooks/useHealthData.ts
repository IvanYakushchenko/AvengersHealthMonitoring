import { useCallback, useEffect, useState } from 'react';
import { healthApi, type StatusResult } from '../api/healthApi';
import { BACKEND_INDICATOR_IDS } from '../data/indicatorBindings';

export interface HealthSnapshot {
  // Newest rating per backend indicator id.
  statuses: Record<string, StatusResult>;
  // Values of the newest reading per indicator id (only indicators with a reading).
  latestValues: Record<string, Record<string, number>>;
  streak: number;
  points: number;
}

// Loads everything the indications page shows. Call refresh() after saving a reading.
export function useHealthData() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [overview, checklist, histories] = await Promise.all([
        healthApi.getStatus(),
        healthApi.getChecklist(),
        Promise.all(BACKEND_INDICATOR_IDS.map((id) => healthApi.getReadings(id))),
      ]);

      const statuses: Record<string, StatusResult> = {};
      overview.regions.forEach((region) =>
        region.indicators.forEach((result) => {
          statuses[result.indicatorId] = result;
        }),
      );

      const latestValues: HealthSnapshot['latestValues'] = {};
      BACKEND_INDICATOR_IDS.forEach((id, index) => {
        const history = histories[index];
        if (history.length > 0) latestValues[id] = history[history.length - 1].values;
      });

      setSnapshot({
        statuses,
        latestValues,
        streak: checklist.streak,
        points: checklist.points,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, error, loading, refresh };
}
