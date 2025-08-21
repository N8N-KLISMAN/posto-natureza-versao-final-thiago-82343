import React from "react";
import { ImageCapture } from "./ImageCapture";
import { ImageMetadataDisplay } from "./ImageMetadataDisplay";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StationData, PeriodKey } from "@/lib/localStorage";
import { AlertCircle, PencilLine, Building2, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";

export type PriceKey = "etanol" | "gasolinaComum" | "gasolinaAditivada" | "dieselS10";

const sanitizePrice = (raw: string) => {
  // keep only digits, max 3; format naturally without comma lock
  if (raw === "Sem dados") return "Sem dados";
  const digits = raw.replace(/\D/g, "").slice(0, 3);
  if (digits.length === 0) return "";
  if (digits.length === 1) return digits[0]; // Just "X"
  if (digits.length === 2) return `${digits[0]},${digits[1]}`; // "X,Y"
  return `${digits[0]},${digits[1]}${digits[2]}`; // "X,YZ"
};

const prefixForId = (id: string): string => {
  if (id === "reference") return "Posto Natureza: ";
  const m = id.match(/competitor_(\d+)/);
  const n = m ? Number(m[1]) : undefined;
  return `Posto Concorrente ${n ?? 1}: `;
};

interface PriceInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}

const PriceInput: React.FC<PriceInputProps> = ({ label, value, onChange, error }) => {
  const isNoData = value === "Sem dados";
  const displayValue = isNoData ? "Sem dados" : value;
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <Label className="mb-1 block leading-tight whitespace-normal break-words">
          <span className="block font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">(R$)</span>
        </Label>
        <Input
          inputMode="numeric"
          placeholder="0,00"
          value={displayValue}
          onChange={(e) => onChange(sanitizePrice(e.target.value))}
          disabled={isNoData}
        />
        {error && (
          <p className="text-sm text-destructive mt-1">Preencha aqui!</p>
        )}
      </div>
      <div className="flex items-center gap-2 pt-7">
        {!isNoData && (
          <span className="text-sm text-muted-foreground">Sem dados</span>
        )}
        <Checkbox
          id={`${label}-nodata`}
          aria-label="Sem dados"
          checked={isNoData}
          onCheckedChange={(c) => onChange(c ? "Sem dados" : "")}
        />
      </div>
    </div>
  );
};

interface CardStationProps {
  id: string;
  name: string;
  value: StationData;
  onChange: (next: StationData) => void;
  onNameChange: (name: string) => void;
  period: string; // Adiciona period para ImageCapture
  errors?: {
    photo?: boolean;
    prices?: {
      vista?: Partial<Record<PriceKey, boolean>>;
      prazo?: Partial<Record<PriceKey, boolean>>;
    };
  };
}

export const CardStation: React.FC<CardStationProps> = ({ id, name, value, onChange, onNameChange, period, errors }) => {
  const [editing, setEditing] = React.useState(false);
  const [editingName, setEditingName] = React.useState(name);
  React.useEffect(() => {
    const pref = prefixForId(id);
    const candidate = name.startsWith(pref) ? name : `${pref}${name.replace(/^.*?:\s*/, "")}`;
    setEditingName(candidate);
  }, [name, id, editing]);

  return (
    <Card className="shadow-sm animate-in fade-in-50">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          {editing ? (
            <div className="flex items-center gap-3 w-full">
              <Input
                autoFocus
                value={editingName}
                onChange={(e) => {
                  const raw = e.target.value;
                  const pref = prefixForId(id);
                  // Não permite deletar o prefixo - sempre mantenha ele
                  if (!raw.startsWith(pref)) {
                    return; // Ignora a mudança se tentar deletar o prefixo
                  }
                  const suffix = raw.slice(pref.length);
                  const clean = suffix.replace(/\r?\n/g, "");
                  setEditingName(pref + clean);
                }}
                onFocus={(e) => {
                  const input = e.target as HTMLInputElement;
                  const prefLen = prefixForId(id).length;
                  setTimeout(() => {
                    try { input.setSelectionRange(prefLen, input.value.length); } catch {}
                  }, 0);
                }}
                onKeyDown={(e) => {
                  const input = e.target as HTMLInputElement;
                  const prefLen = prefixForId(id).length;
                  // Impede deletar quando cursor está no prefixo
                  if (input.selectionStart !== null && input.selectionStart < prefLen && 
                      (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft')) {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                      e.preventDefault();
                    }
                    if (e.key === 'ArrowLeft' && input.selectionStart <= prefLen) {
                      e.preventDefault();
                      input.setSelectionRange(prefLen, prefLen);
                    }
                  }
                }}
                onBlur={() => { onNameChange(editingName); setEditing(false); }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                {id === "reference" ? (
                  <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                ) : (
                  <Fuel className="h-5 w-5 text-primary" aria-hidden="true" />
                )}
                {name}
              </h3>
              <button type="button" aria-label="Editar nome" className={cn("rounded-md p-2 border", "hover:bg-accent transition-all")}
                onClick={() => setEditing(true)}>
                <PencilLine className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

            <div className="space-y-3">
              <ImageCapture
                period={period}
                stationId={id}
                label={`Tirar foto da placa do ${name}`}
                valueBase64={value.photoBase64}
                onBase64={(b64) => onChange({ ...value, photoBase64: b64 })}
                onClear={() => onChange({ ...value, photoBase64: "", metadata: undefined })}
                onMetadata={(metadata) => onChange({ ...value, metadata })}
                allowGallery={true}
              />
              {value.metadata && (
                <ImageMetadataDisplay 
                  metadata={value.metadata}
                  className="ml-2"
                />
              )}
            </div>
            {errors?.photo && (
              <p className="text-sm text-destructive mt-2">Envio de Foto aqui!</p>
            )}


        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-nochange`} checked={value.noChange} onCheckedChange={(c) => onChange({ ...value, noChange: Boolean(c) })} />
          <Label htmlFor={`${id}-nochange`}>Não houve alteração nos preços hoje</Label>
        </div>

        {!value.noChange && (
          <section className="space-y-3">
            <h4 className="text-base font-semibold text-center">Preços à Vista</h4>
            <div className="grid md:grid-cols-2 gap-5">
<PriceInput label="Etanol" value={value.prices.vista.etanol} onChange={(v) => onChange({ ...value, prices: { ...value.prices, vista: { ...value.prices.vista, etanol: v } } })} error={Boolean(errors?.prices?.vista?.etanol)} />
<PriceInput label="Gasolina Comum" value={value.prices.vista.gasolinaComum} onChange={(v) => onChange({ ...value, prices: { ...value.prices, vista: { ...value.prices.vista, gasolinaComum: v } } })} error={Boolean(errors?.prices?.vista?.gasolinaComum)} />
<PriceInput label="Gasolina Aditivada" value={value.prices.vista.gasolinaAditivada} onChange={(v) => onChange({ ...value, prices: { ...value.prices, vista: { ...value.prices.vista, gasolinaAditivada: v } } })} error={Boolean(errors?.prices?.vista?.gasolinaAditivada)} />
<PriceInput label="Diesel S-10" value={value.prices.vista.dieselS10} onChange={(v) => onChange({ ...value, prices: { ...value.prices, vista: { ...value.prices.vista, dieselS10: v } } })} error={Boolean(errors?.prices?.vista?.dieselS10)} />
            </div>
          </section>
        )}

        {!value.noChange && (
          <section className="space-y-3">
            <h4 className="text-base font-semibold text-center">Preços a Prazo</h4>
            <div className="grid md:grid-cols-2 gap-5">
<PriceInput label="Etanol" value={value.prices.prazo.etanol} onChange={(v) => onChange({ ...value, prices: { ...value.prices, prazo: { ...value.prices.prazo, etanol: v } } })} error={Boolean(errors?.prices?.prazo?.etanol)} />
<PriceInput label="Gasolina Comum" value={value.prices.prazo.gasolinaComum} onChange={(v) => onChange({ ...value, prices: { ...value.prices, prazo: { ...value.prices.prazo, gasolinaComum: v } } })} error={Boolean(errors?.prices?.prazo?.gasolinaComum)} />
<PriceInput label="Gasolina Aditivada" value={value.prices.prazo.gasolinaAditivada} onChange={(v) => onChange({ ...value, prices: { ...value.prices, prazo: { ...value.prices.prazo, gasolinaAditivada: v } } })} error={Boolean(errors?.prices?.prazo?.gasolinaAditivada)} />
<PriceInput label="Diesel S-10" value={value.prices.prazo.dieselS10} onChange={(v) => onChange({ ...value, prices: { ...value.prices, prazo: { ...value.prices.prazo, dieselS10: v } } })} error={Boolean(errors?.prices?.prazo?.dieselS10)} />
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
};
