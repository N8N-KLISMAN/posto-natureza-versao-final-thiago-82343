import { AppState, PeriodKey, StationData } from "./localStorage";
import { format } from "date-fns";

const normalizePrice = (value: string): string => {
  if (!value) return "";
  if (value === "Sem dados") return "Sem dados";
  // replace thousand separators and convert comma to dot
  const v = value.replace(/\./g, "").replace(",", ".");
  return v;
};

// Fixed prefixes mapping based on StationKey
// Only keys used by the current app will be referenced (postoNatureza1 and concorrente1..10)
export type StationKey =
  | "postoNatureza1"
  | "postoNatureza2"
  | "postoNatureza3"
  | "concorrente1"
  | "concorrente2"
  | "concorrente3"
  | "concorrente4"
  | "concorrente5"
  | "concorrente6"
  | "concorrente7"
  | "concorrente8"
  | "concorrente9"
  | "concorrente10";

const PREFIX_MAP: Record<StationKey, string> = {
  postoNatureza1: "(Posto Natureza 1)",
  postoNatureza2: "(Posto Natureza 2)",
  postoNatureza3: "(Posto Natureza 3)",
  concorrente1: "(Concorrente 1)",
  concorrente2: "(Concorrente 2)",
  concorrente3: "(Concorrente 3)",
  concorrente4: "(Concorrente 4)",
  concorrente5: "(Concorrente 5)",
  concorrente6: "(Concorrente 6)",
  concorrente7: "(Concorrente 7)",
  concorrente8: "(Concorrente 8)",
  concorrente9: "(Concorrente 9)",
  concorrente10: "(Concorrente 10)",
};

const stationKeyFromId = (id: string): StationKey | undefined => {
  if (id === "reference") return "postoNatureza1";
  const m = id.match(/^competitor_(\d+)$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (n < 1 || n > 10) return undefined;
  return (`concorrente${n}` as StationKey);
};

const section = (
  prefixLabel: string,
  type: "vista" | "prazo",
  prices: StationData["prices"][typeof type]
) => {
  const title = type === "vista" ? "Preços a vista" : "Preços a Prazo";
  return {
    [`${prefixLabel} ${title}/etanol`]: normalizePrice(prices.etanol),
    [`${prefixLabel} ${title}/gasolinaComum`]: normalizePrice(prices.gasolinaComum),
    [`${prefixLabel} ${title}/gasolinaAditivada`]: normalizePrice(prices.gasolinaAditivada),
    [`${prefixLabel} ${title}/dieselS10`]: normalizePrice(prices.dieselS10),
  } as Record<string, string>;
};

export const formatPayloadForN8n = (
  period: PeriodKey,
  state: AppState
): Record<string, string> => {
  const now = new Date();
  const payload: Record<string, string> = {
    "Data e Hora do Envio": format(now, "dd/MM/yyyy (HH:mm)"),
    "Periodo Marcado": period === "manha" ? "Manhã" : "Tarde",
  };

  const ids = Object.keys(state.periods[period].stations);
  ids.forEach((id) => {
    const name = state.meta.names[id] || id;
    const st = state.periods[period].stations[id];

    const sk = stationKeyFromId(id);
    const prefix = sk ? PREFIX_MAP[sk] : `(${name})`;

    // Keep editable names as separate fields
    if (id === "reference") {
      payload["Nome do Posto"] = name;
    } else {
      const m = id.match(/^competitor_(\d+)$/);
      if (m) payload[`Nome do Concorrente ${m[1]}`] = name;
    }

    Object.assign(payload, section(prefix, "vista", st.prices.vista));
    Object.assign(payload, section(prefix, "prazo", st.prices.prazo));

    payload[`${prefix} ${id === "reference" ? "Foto da minha placa" : "Foto da placa"}`] = st.photoBase64 || "";
    payload[`${prefix} Marcou Opção de Alteração de preço`] = st.noChange ? "SIM" : "NÃO";
    
    // Adiciona metadados da imagem
    if (st.metadata) {
      if (st.metadata.dateTime) {
        payload[`${prefix} Data/Hora da Foto`] = new Date(st.metadata.dateTime).toLocaleString('pt-BR');
      }
      if (st.metadata.make && st.metadata.model) {
        payload[`${prefix} Dispositivo da Foto`] = `${st.metadata.make} ${st.metadata.model}`;
      }
      if (st.metadata.validationStatus) {
        payload[`${prefix} Status da Validação`] = st.metadata.validationStatus === 'validated' ? 'VALIDADA' : 
                                                   st.metadata.validationStatus === 'warning' ? 'AVISO' : 'INVÁLIDA';
      }
      if (st.metadata.gps?.latitude && st.metadata.gps?.longitude) {
        payload[`${prefix} GPS da Foto`] = `${st.metadata.gps.latitude.toFixed(6)}, ${st.metadata.gps.longitude.toFixed(6)}`;
      }
    }
  });

  return payload;
};
