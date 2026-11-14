// Typed client for the AvengersHealthMonitoring backend (see its README for the full contract).

// Backend ratings. The frontend maps them to AlertStatus (see indicatorBindings.ts).
export type BackendStatus = 'normal' | 'caution' | 'urgent' | 'unknown';

export interface StatusResult {
  indicatorId: string;
  status: BackendStatus;
  message: string;
  escalate: boolean;
}

export interface RegionStatus {
  regionId: string;
  status: BackendStatus;
  indicators: StatusResult[];
}

export interface StatusOverview {
  regions: RegionStatus[];
}

export interface Reading {
  indicatorId: string;
  values: Record<string, number>;
  takenAt: string;
}

export interface NewReading {
  indicatorId: string;
  values: Record<string, number>;
  takenAt?: string;
}

export interface ChecklistItem {
  indicatorId: string;
  due: boolean;
  lastTakenAt: string | null;
}

export interface Checklist {
  items: ChecklistItem[];
  streak: number;
  points: number;
}

// Shown in the UI when the backend cannot be reached or rejects a request.
export class ApiError extends Error {}

const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(`Cannot reach the backend at ${API_BASE}. Is it running?`);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && 'detail' in body) {
        const detail = (body as { detail: unknown }).detail;
        if (typeof detail === 'string') message = detail;
      }
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new ApiError(message);
  }

  return (await res.json()) as T;
}

export const healthApi = {
  getStatus: () => request<StatusOverview>('/api/status'),

  getChecklist: () => request<Checklist>('/api/checklist'),

  // Oldest first, so the last item is the newest reading.
  getReadings: (indicatorId: string, days = 365) =>
    request<Reading[]>(`/api/readings?indicator=${encodeURIComponent(indicatorId)}&days=${days}`),

  postReading: (reading: NewReading) =>
    request<StatusResult>('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reading),
    }),
};
