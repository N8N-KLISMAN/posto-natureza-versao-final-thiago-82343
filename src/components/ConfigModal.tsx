import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings } from "lucide-react";
import { setConcorrentesCount } from "@/lib/localStorage";

interface ConfigModalProps {
  count: number;
  onChanged: () => void;
}

const options = Array.from({ length: 10 }, (_, i) => i + 1);

export const ConfigModal: React.FC<ConfigModalProps> = ({ count, onChanged }) => {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(String(count));
  

  const onConfirm = () => {
    setConcorrentesCount(Number(value));
    onChanged();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Configurações" className="h-12 w-12 md:h-14 md:w-14">
          <Settings className="h-7 w-7" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4">
            <Label className="shrink-0">Concorrentes</Label>
            {/* Indicative dashed arrow between label and select (desktop only) */}
            <div className="relative hidden md:block flex-1 pointer-events-none">
              <svg
                className="w-full h-5 text-muted-foreground/50"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="10" x2="92" y2="10" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
                <polyline points="92,4 100,10 92,16" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>

            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {options.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} Concorrente{n > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className="block">Instruções de Uso</Label>
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p><span className="font-medium">1.</span> Ajuste essa configuração acima de acordo com a quantidade de Concorrentes que irá enviar dados.</p>
                <p><span className="font-medium">2.</span> Edite corretamente o nome do Seu Posto e dos seus Concorrentes.</p>
                <p><span className="font-medium">3.</span> Preencha todos os campos e envie os dados do período da Manhã e da Tarde.</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
