// Typed client for the AvengersHealthMonitoring backend (its README lists every endpoint).

// Backend ratings. The indications page maps them to its own AlertStatus values.
export type BackendStatus = 'normal' | 'caution' | 'urgent' | 'unknown';

// A rating for one indicator, as the backend returns it (normal, caution, urgent or unknown).
export interface StatusResult {
  indicatorId: string;
  status: BackendStatus;
  message: string;
  escalate: boolean;
}

// The rating of one body region, with the ratings of the indicators in it.
export interface RegionStatus {
  regionId: string;
  status: BackendStatus;
  indicators: StatusResult[];
}

// Answer of GET /api/status: all body regions.
export interface StatusOverview {
  regions: RegionStatus[];
}

// A saved reading. The id is needed to correct or delete it.
export interface Reading {
  id: number;
  indicatorId: string;
  values: Record<string, number>;
  takenAt: string;
}

// A reading to save. takenAt is optional; the server uses the current time when it is missing.
export interface NewReading {
  indicatorId: string;
  values: Record<string, number>;
  takenAt?: string;
}

// Answer of GET /api/checklist: which measurements are due, plus streak and points.
export interface Checklist {
  items: { indicatorId: string; due: boolean; lastTakenAt: string | null }[];
  streak: number;
  points: number;
}

// Range the simulated sensors use for this value (set in the backend's rules.json).
export interface SimulationRange {
  min: number;
  max: number;
  whole?: boolean;
}

// The rules for one value of an indicator (allowed limits, normal and caution ranges, optional flags, simulation range).
export interface ValueRule {
  limits: [number, number];
  normal: [number, number];
  caution: [number, number];
  optional: boolean;
  wholeNumber: boolean;
  simulation?: SimulationRange | null;
}

// One indicator with its region and value rules, from GET /api/indicators.
export interface IndicatorInfo {
  indicatorId: string;
  region: string;
  dueEveryHours: number;
  values: Record<string, ValueRule>;
}

// Crew sex picks the 3D body model. Mission control accounts have none (null).
export type Sex = 'male' | 'female';

// Answer of POST /api/login. Keep the token and send it with every other request.
export interface Session {
  token: string;
  astronautId: number;
  username: string;
  isAdmin: boolean;
  isSuperadmin: boolean;
  sex: Sex | null;
  crewId: number | null;
  crewName: string | null;
}

// One crew account as mission control sees it.
export interface CrewMember {
  astronautId: number;
  username: string;
  sex: Sex;
  createdAt: string;
  status: BackendStatus;
  alertCount: number;
}

// Shown in the UI when the backend cannot be reached or rejects a request.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// One validation problem from the server, e.g. "password: String should have at least 8 characters".
function validationMessage(problem: unknown): string {
  const { loc, msg } = (problem ?? {}) as { loc?: unknown[]; msg?: unknown };
  if (typeof msg !== 'string') return 'Please check the values you entered.';
  const field = Array.isArray(loc) ? loc[loc.length - 1] : undefined;
  return typeof field === 'string' && field !== 'body' ? `${field}: ${msg}` : msg;
}

// True when the server said the login is missing or expired (HTTP 401). The app then logs out.
export const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;

// Where the backend is. Set VITE_API_URL to change it (see frontend/.env.example).
const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Options for one request: the login token, the HTTP method and the JSON body.
interface RequestOptions {
  token?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

// The one function every request goes through. It adds the login token and the JSON body, turns network failures and error answers into ApiError with a readable message, and returns the parsed JSON.
async function request<T>(path: string, { token, method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Cannot reach the backend at ${API_BASE}. Is it running?`, 0);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = (data as { detail: unknown }).detail;
        if (typeof detail === 'string') message = detail;
        else if (Array.isArray(detail) && detail.length > 0) message = validationMessage(detail[0]);
      }
    } catch {
      // Not JSON: keep the generic message.
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

// ---------- accounts ----------

// Login, logout, password change and the public indicator list.
export const authApi = {
  login: (username: string, password: string) =>
    request<Session>('/api/login', { method: 'POST', body: { username, password } }),

  logout: (token: string) => request<{ message: string }>('/api/logout', { token, method: 'POST' }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/api/me/password', {
      token,
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  // Public: the same for everyone, used to build the input forms.
  getIndicators: () => request<IndicatorInfo[]>('/api/indicators'),
};

// ---------- health data: one interface for the crew and for mission control ----------

// Everything the indications page needs. The crew version uses /api/...,
// the mission control version uses /api/admin/astronauts/{id}/... for one crew member.
export interface HealthSource {
  // false for read-only views: nothing can be corrected or deleted through them.
  canEdit: boolean;
  getStatus: () => Promise<StatusOverview>;
  getChecklist: () => Promise<Checklist>;
  getReadings: (indicatorId: string, days?: number) => Promise<Reading[]>;
  updateReading: (readingId: number, values: Record<string, number>) => Promise<StatusResult>;
  deleteReading: (readingId: number) => Promise<void>;
  // null when this user cannot log new readings (mission control has none of its own).
  createReading: ((reading: NewReading) => Promise<StatusResult>) | null;
}

// Health data for the logged-in crew member, using the /api/... endpoints.
export function crewSource(token: string): HealthSource {
  return {
    canEdit: true,
    getStatus: () => request<StatusOverview>('/api/status', { token }),
    getChecklist: () => request<Checklist>('/api/checklist', { token }),
    getReadings: (indicatorId, days = 365) =>
      request<Reading[]>(`/api/readings?indicator=${encodeURIComponent(indicatorId)}&days=${days}`, { token }),
    updateReading: (readingId, values) =>
      request<StatusResult>(`/api/readings/${readingId}`, { token, method: 'PUT', body: { values } }),
    deleteReading: (readingId) =>
      request<{ message: string }>(`/api/readings/${readingId}`, { token, method: 'DELETE' }).then(() => undefined),
    createReading: (reading) =>
      request<StatusResult>('/api/readings', { token, method: 'POST', body: reading }),
  };
}

// Health data of one crew member as seen by mission control (/api/admin/... endpoints). Read and write, but no new readings.
export function crewMemberSource(token: string, astronautId: number): HealthSource {
  const base = `/api/admin/astronauts/${astronautId}`;
  return {
    canEdit: true,
    getStatus: () => request<StatusOverview>(`${base}/status`, { token }),
    getChecklist: () => request<Checklist>(`${base}/checklist`, { token }),
    getReadings: (indicatorId, days = 365) =>
      request<Reading[]>(`${base}/readings?indicator=${encodeURIComponent(indicatorId)}&days=${days}`, { token }),
    updateReading: (readingId, values) =>
      request<StatusResult>(`/api/admin/readings/${readingId}`, { token, method: 'PUT', body: { values } }),
    deleteReading: (readingId) =>
      request<{ message: string }>(`/api/admin/readings/${readingId}`, { token, method: 'DELETE' }).then(() => undefined),
    createReading: null,
  };
}

// Read-only health of one crew member, seen by the superadmin.
export function superadminMemberSource(token: string, crewId: number, astronautId: number): HealthSource {
  const base = `/api/superadmin/crews/${crewId}/members/${astronautId}`;
  const readOnly = () => Promise.reject(new ApiError('This view is read-only.', 403));
  return {
    canEdit: false,
    getStatus: () => request<StatusOverview>(`${base}/status`, { token }),
    getChecklist: () => request<Checklist>(`${base}/checklist`, { token }),
    getReadings: (indicatorId, days = 365) =>
      request<Reading[]>(`${base}/readings?indicator=${encodeURIComponent(indicatorId)}&days=${days}`, { token }),
    updateReading: readOnly,
    deleteReading: readOnly,
    createReading: null,
  };
}

// ---------- mission control: crew accounts ----------

// Mission control: list, create, reset the password of, and delete crew members of its own crew.
export const adminApi = {
  listCrew: (token: string) => request<CrewMember[]>('/api/admin/astronauts', { token }),

  createCrew: (token: string, username: string, password: string, sex: Sex) =>
    request<{ astronautId: number; username: string; isAdmin: boolean; sex: Sex }>('/api/admin/astronauts', {
      token,
      method: 'POST',
      body: { username, password, sex },
    }),

  resetPassword: (token: string, astronautId: number, newPassword: string) =>
    request<{ message: string }>(`/api/admin/astronauts/${astronautId}/password`, {
      token,
      method: 'POST',
      body: { newPassword },
    }),

  deleteCrew: (token: string, astronautId: number) =>
    request<{ message: string }>(`/api/admin/astronauts/${astronautId}`, { token, method: 'DELETE' }),
};

// ---------- superadmin: crews and their mission control accounts ----------

// One crew as the superadmin sees it.
export interface Crew {
  crewId: number;
  name: string;
  createdAt: string;
  memberCount: number;
  adminCount: number;
}

// One crew member in a crew (passwords are never included).
export interface CrewMemberInfo {
  astronautId: number;
  username: string;
  sex: Sex | null;
  createdAt: string;
}

// One mission control account of a crew.
export interface CrewAdmin {
  astronautId: number;
  username: string;
  createdAt: string;
}

// Superadmin: crews, their members and their mission control accounts.
export const superadminApi = {
  listCrews: (token: string) => request<Crew[]>('/api/superadmin/crews', { token }),

  createCrew: (token: string, name: string) =>
    request<Crew>('/api/superadmin/crews', { token, method: 'POST', body: { name } }),

  deleteCrew: (token: string, crewId: number) =>
    request<{ message: string }>(`/api/superadmin/crews/${crewId}`, { token, method: 'DELETE' }),

  deleteMember: (token: string, crewId: number, astronautId: number) =>
    request<{ message: string }>(`/api/superadmin/crews/${crewId}/members/${astronautId}`, { token, method: 'DELETE' }),

  listCrewMembers: (token: string, crewId: number) =>
    request<CrewMemberInfo[]>(`/api/superadmin/crews/${crewId}/members`, { token }),

  resetMemberPassword: (token: string, crewId: number, astronautId: number, newPassword: string) =>
    request<{ message: string }>(`/api/superadmin/crews/${crewId}/members/${astronautId}/password`, {
      token,
      method: 'POST',
      body: { newPassword },
    }),

  listCrewAdmins: (token: string, crewId: number) =>
    request<CrewAdmin[]>(`/api/superadmin/crews/${crewId}/admins`, { token }),

  createCrewAdmin: (token: string, crewId: number, username: string, password: string) =>
    request<Session>(`/api/superadmin/crews/${crewId}/admins`, {
      token,
      method: 'POST',
      body: { username, password },
    }),
};
