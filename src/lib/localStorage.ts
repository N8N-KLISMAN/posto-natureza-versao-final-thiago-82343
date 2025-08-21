import { INTERNAL_WEBHOOK_URL } from "../config/webhook";

export type PriceFields = {
  etanol: string;
  gasolinaComum: string;
  gasolinaAditivada: string;
  dieselS10: string;
};

export type StationData = {
  photoBase64?: string; // stored without data:image/... prefix
  noChange: boolean;
  prices: {
    vista: PriceFields;
    prazo: PriceFields;
  };
  metadata?: {
    dateTime?: string; // ISO string
    make?: string;
    model?: string;
    software?: string;
    gps?: {
      latitude?: number;
      longitude?: number;
    };
    validationStatus?: 'validated' | 'invalid' | 'warning';
    validationReason?: string;
  };
};

export type PeriodKey = "manha" | "tarde";

export type AppState = {
  config: {
    concorrentesCount: number;
    webhookUrl?: string;
  };
  meta: {
    lastEdited?: string;
    lastSent?: Partial<Record<PeriodKey, string>>;
    names: Record<string, string>; // reference, competitor_1..n
  };
  periods: Record<PeriodKey, { stations: Record<string, StationData> }>;
};

const STORAGE_KEY = "price_registry_app_state";

export const stationIdForIndex = (index: number) =>
  index === 0 ? "reference" : `competitor_${index}`;

export const defaultNameForIndex = (index: number) =>
  index === 0 ? "Posto Natureza: " : `Posto Concorrente ${index}: `;

const emptyPriceFields = (): PriceFields => ({
  etanol: "",
  gasolinaComum: "",
  gasolinaAditivada: "",
  dieselS10: "",
});

const emptyStation = (): StationData => ({
  photoBase64: "",
  noChange: false,
  prices: { vista: emptyPriceFields(), prazo: emptyPriceFields() },
});

export const buildDefaultState = (concorrentes = 1): AppState => {
  const names: Record<string, string> = {};
  const stations: Record<string, StationData> = {};
  for (let i = 0; i <= concorrentes; i++) {
    const id = stationIdForIndex(i);
    names[id] = defaultNameForIndex(i);
    stations[id] = emptyStation();
  }
  const base = { stations };
  return {
    config: { concorrentesCount: concorrentes },
    meta: { names, lastEdited: new Date().toISOString() },
    periods: { manha: structuredClone(base), tarde: structuredClone(base) },
  };
};

export const readAppState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultState();
    const parsed = JSON.parse(raw) as AppState;

    // Ensure structure integrity and merge defaults when upgrading schema
    const concorrentes = parsed?.config?.concorrentesCount ?? 1;
    const safe = buildDefaultState(concorrentes);

    // Merge meta names
    safe.meta = {
      ...safe.meta,
      ...parsed.meta,
      names: { ...safe.meta.names, ...(parsed.meta?.names || {}) },
    };

    // Merge periods data
    (Object.keys(safe.periods) as PeriodKey[]).forEach((p) => {
      const incoming = parsed.periods?.[p]?.stations || {};
      safe.periods[p].stations = { ...safe.periods[p].stations, ...incoming };
    });

    // Keep webhookUrl if present
    safe.config.webhookUrl = parsed.config?.webhookUrl;

    return safe;
  } catch (e) {
    console.error("[localStorage] Failed to parse app state, resetting.", e);
    return buildDefaultState();
  }
};

export const saveAppState = (state: AppState) => {
  const next: AppState = {
    ...state,
    meta: { ...state.meta, lastEdited: new Date().toISOString() },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Dispatch a custom event to sync within same tab components
  window.dispatchEvent(new CustomEvent("app-state-updated"));
};

export const setConcorrentesCount = (count: number) => {
  const state = readAppState();
  const current = state.config.concorrentesCount;
  if (count === current) return state;

  // Adjust names and stations collections
  for (let i = 0; i <= count; i++) {
    const id = stationIdForIndex(i);
    if (!state.meta.names[id]) state.meta.names[id] = defaultNameForIndex(i);
    if (!state.periods.manha.stations[id]) state.periods.manha.stations[id] = emptyStation();
    if (!state.periods.tarde.stations[id]) state.periods.tarde.stations[id] = emptyStation();
  }
  // Remove excess
  for (let i = count + 1; i <= 20; i++) {
    const id = stationIdForIndex(i);
    delete state.meta.names[id];
    delete state.periods.manha.stations[id];
    delete state.periods.tarde.stations[id];
  }

  state.config.concorrentesCount = count;
  saveAppState(state);
  return state;
};

export const clearPeriodData = (period: PeriodKey) => {
  const state = readAppState();
  const ids = Object.keys(state.periods[period].stations);
  ids.forEach((id) => {
    state.periods[period].stations[id] = emptyStation();
  });
  saveAppState(state);
  return state;
};

export const updateStationName = (id: string, name: string) => {
  const state = readAppState();
  state.meta.names[id] = name;
  saveAppState(state);
  return state;
};

export const updateWebhookUrl = (url?: string) => {
  const state = readAppState();
  state.config.webhookUrl = url;
  saveAppState(state);
  return state;
};

export const getVisibleStationIds = (state: AppState) => {
  const ids: string[] = [];
  for (let i = 0; i <= state.config.concorrentesCount; i++) {
    ids.push(stationIdForIndex(i));
  }
  return ids;
};

export const getWebhookUrl = (): string | undefined => {
  // Fallback priorities: internal config -> env -> localStorage -> default constant
  
  // 1. Internal configuration (highest priority)
  if (INTERNAL_WEBHOOK_URL && typeof INTERNAL_WEBHOOK_URL === "string") {
    return INTERNAL_WEBHOOK_URL;
  }

  // 2. Environment variables
  // Observação: em Lovable, variáveis .env não são suportadas; mantemos por compatibilidade
  const envUrl =
    (import.meta as any).env?.NEXT_PUBLIC_WEBHOOK_URL ||
    (import.meta as any).env?.REACT_APP_WEBHOOK_URL ||
    (import.meta as any).env?.VITE_WEBHOOK_URL;
  if (envUrl && typeof envUrl === "string") return envUrl;

  const stored = readAppState().config.webhookUrl;
  if (stored) return stored;

  // Default do projeto (n8n)
  const DEFAULT_WEBHOOK_URL =
    "https://criadordigital-n8n-editor.xpr5o6.easypanel.host/webhook/SiteFormulario";
  return DEFAULT_WEBHOOK_URL;
};

export const stripDataUrlPrefix = (dataUrl: string) =>
  dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
