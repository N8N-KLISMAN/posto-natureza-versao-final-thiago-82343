import React from "react";
import { Button } from "@/components/ui/button";
import { CardStation } from "@/components/CardStation";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AppState,
  PeriodKey,
  readAppState,
  saveAppState,
  clearPeriodData,
  getVisibleStationIds,
  getWebhookUrl,
} from "@/lib/localStorage";
import { formatPayloadForN8n } from "@/lib/formatPayloadForN8n";
import { imageKey, getImageBlob, blobToDataURL, dataURLToBase64, removeImageBlob, clearImageCache } from "@/lib/imagesDB";
import { z } from "zod";

interface PriceFormProps {
  period: PeriodKey;
}

// Validation schema builder using zod with dynamic stations and superRefine rules
const createPriceFormSchema = () => {
  const priceFieldsSchema = z.object({
    etanol: z.string().optional(),
    gasolinaComum: z.string().optional(),
    gasolinaAditivada: z.string().optional(),
    dieselS10: z.string().optional(),
  });

  const stationSchema = z
    .object({
      photoBase64: z.string().optional(),
      noChange: z.boolean(),
      prices: z.object({
        vista: priceFieldsSchema,
        prazo: priceFieldsSchema,
      }),
    })
    .superRefine((val, ctx) => {
      // Foto sempre obrigatória
      if (!val.photoBase64) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["photoBase64"],
          message: "Envio de Foto aqui!",
        });
      }

      // Preços obrigatórios se NÃO marcado "Não houve alteração"
      if (!val.noChange) {
        const keys: Array<keyof typeof val.prices.vista> = [
          "etanol",
          "gasolinaComum",
          "gasolinaAditivada",
          "dieselS10",
        ];
        (["vista", "prazo"] as const).forEach((ptype) => {
          keys.forEach((k) => {
            const v = val.prices[ptype][k];
            if (!v || v.trim() === "") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["prices", ptype, k],
                message: "Preencha aqui!",
              });
            }
          });
        });
      }
    });

  return z.object({
    stations: z.record(z.string(), stationSchema),
  });
};

export const PriceForm: React.FC<PriceFormProps> = ({ period }) => {
  const [state, setState] = React.useState<AppState>(readAppState());
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, any>>({});
  const { toast } = useToast();

  React.useEffect(() => {
    const sync = () => setState(readAppState());
    window.addEventListener("app-state-updated", sync);
    return () => window.removeEventListener("app-state-updated", sync);
  }, []);

  const ids = getVisibleStationIds(state);

  const onStationChange = (
    id: string,
    updater: Parameters<typeof saveAppState>[0]["periods"][PeriodKey]["stations"][string]
  ) => {
    const next = readAppState();
    next.periods[period].stations[id] = updater;
    saveAppState(next);
    setState(next);
  };

  const onNameChange = (id: string, name: string) => {
    const next = readAppState();
    next.meta.names[id] = name;
    saveAppState(next);
    setState(next);
  };

  // Remove imagens e metadados do storage híbrido ao limpar período
  const deleteImagesForPeriod = (period: PeriodKey) => {
    const allIds = ['reference', ...Array.from({ length: 10 }, (_, i) => `competitor_${i + 1}`)];
    allIds.forEach(id => {
      const key = imageKey(period, id);
      const metaKey = key.replace('img:', 'meta:');
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        localStorage.removeItem(metaKey);
        sessionStorage.removeItem(metaKey);
      } catch (e) {
        console.error('Failed to remove image:', e);
      }
    });
  };

  const onClear = () => {
    const next = clearPeriodData(period);
    // Também limpa as imagens do storage híbrido
    deleteImagesForPeriod(period);
    setState(next);
    setErrors({});
  };

  const validateForm = async () => {
    // Primeiro, hidrata imagens em falta do storage híbrido
    const currentState = readAppState();
    let updated = false;
    
    for (const id of ids) {
      const station = currentState.periods[period].stations[id];
      if (!station.photoBase64) {
        // Tenta localStorage primeiro, depois sessionStorage
        const key = imageKey(period, id);
        const base64 = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (base64) {
          station.photoBase64 = base64;
          updated = true;
        }
      }
    }
    
    // Se houve atualização, salva o estado e atualiza o component state
    if (updated) {
      saveAppState(currentState);
      setState(currentState);
    }

    const schema = createPriceFormSchema();
    const stationsSubset: Record<string, any> = {};
    ids.forEach((id) => {
      stationsSubset[id] = currentState.periods[period].stations[id];
    });
    const result = schema.safeParse({ stations: stationsSubset });
    if (result.success) {
      setErrors({});
      return { ok: true as const };
    }

    const errMap: Record<string, any> = {};
    for (const issue of result.error.issues) {
      // Caminhos esperados: ["stations", stationId, ...]
      const stationId = String(issue.path[1] ?? "");
      if (!stationId) continue;
      errMap[stationId] = errMap[stationId] || { prices: { vista: {}, prazo: {} } };
      if (issue.path[2] === "photoBase64") {
        errMap[stationId].photo = true;
      }
      if (issue.path[2] === "prices") {
        const ptype = String(issue.path[3]); // vista | prazo
        const key = String(issue.path[4]); // etanol | gasolinaComum | gasolinaAditivada | dieselS10
        if (!errMap[stationId].prices[ptype]) errMap[stationId].prices[ptype] = {};
        errMap[stationId].prices[ptype][key] = true;
      }
    }
    setErrors(errMap);
    return { ok: false as const, errors: errMap };
  };


  const onSubmit = async () => {
    const url = getWebhookUrl();
    if (!url) {
      toast({ title: "Configure o Webhook", description: "Defina a URL nas Configurações.", variant: "destructive" as any });
      return;
    }

    // Validação antes do envio (agora com hidratação automática)
    const validation = await validateForm();
    if (!validation.ok) {
      toast({
        title:
          "Atenção! Existem campos obrigatórios não preenchidos. Por favor, verifique os campos marcados em vermelho.",
        variant: "destructive" as any,
      });
      return;
    }

    try {
      setLoading(true);
      
      // Estado já foi hidratado na validação
      const readyState = readAppState();
      
      const payload = formatPayloadForN8n(period, readyState);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const next = readAppState();
      next.meta.lastSent = { ...(next.meta.lastSent || {}), [period]: new Date().toISOString() };
      
      // Se foi envio da manhã, copiar preços para a tarde
      if (period === "manha") {
        Object.keys(next.periods.manha.stations).forEach((sid) => {
          const morningStation = next.periods.manha.stations[sid];
          const afternoonStation = next.periods.tarde.stations[sid];
          if (morningStation && afternoonStation) {
            next.periods.tarde.stations[sid] = {
              ...afternoonStation,
              prices: {
                vista: { ...morningStation.prices.vista },
                prazo: { ...morningStation.prices.prazo }
              },
              noChange: false // Sempre permite edição na tarde
            };
          }
        });
      }
      
      // Clear photos, metadata and reset flags while keeping price values
      Object.keys(next.periods[period].stations).forEach((sid) => {
        const st = next.periods[period].stations[sid];
        next.periods[period].stations[sid] = { ...st, photoBase64: "", metadata: undefined, noChange: false };
      });
      
      // Limpar imagens do período (estado + storage híbrido)
      deleteImagesForPeriod(period);
      
      saveAppState(next);
      setState(next);
      setErrors({});
      toast({
        title: period === "manha" 
          ? "✅ Obrigado por me enviar os dados, aguardo o envio da tarde até às 14h, para concluirmos."
          : "✅ Obrigado, por hoje concluímos , em outro dia, basta repetir o mesmo processo.",
      });
    } catch (e: any) {
      console.error("[PriceForm] send error", e);
      toast({ title: "Erro ao enviar", description: String(e?.message || e), variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {ids.map((id) => (
        <CardStation
          key={id}
          id={id}
          name={state.meta.names[id]}
          value={state.periods[period].stations[id]}
          onChange={(next) => onStationChange(id, next)}
          onNameChange={(name) => onNameChange(id, name)}
          period={period}
          errors={errors[id]}
        />
      ))}

      <div className="grid md:grid-cols-[1fr_2fr] gap-4 items-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" disabled={loading}>
              Limpar Dados
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Limpeza</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja limpar todos os dados do formulário? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Não</AlertDialogCancel>
              <AlertDialogAction onClick={onClear}>Sim</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? "Enviando..." : `Enviar Dados (${period === "manha" ? "Manhã" : "Tarde"})`}
        </Button>
      </div>
    </div>
  );
};
