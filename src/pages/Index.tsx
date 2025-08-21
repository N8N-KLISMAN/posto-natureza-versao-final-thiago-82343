import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ConfigModal } from "@/components/ConfigModal";
import { PriceForm } from "@/components/PriceForm";
import { readAppState } from "@/lib/localStorage";
import { CalendarDays, Sun, Sunset } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Index = () => {
  const [, force] = React.useReducer((x) => x + 1, 0);
  const count = readAppState().config.concorrentesCount;
  const today = format(new Date(), "PPP", { locale: ptBR });

  return (
    <main className="min-h-screen bg-brand-gradient">
      <header className="relative bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b shadow-sm">
        <div className="container relative mx-auto px-4 py-5 md:py-6">
          {/* Logo à esquerda */}
          <div className="flex items-center justify-between">
            <div className="shrink-0 flex items-center gap-3">
              <img
                src="/lovable-uploads/f79d63cd-592f-43f5-891f-c055241af883.png"
                alt="Logo Postos Natureza"
                className="h-14 w-14 md:h-12 md:w-12 rounded-full"
                loading="eager"
              />
              <span className="text-base md:text-lg font-semibold"><span className="text-brand-gold">Postos</span><span className="text-primary"> Natureza</span></span>
            </div>
          </div>

          {/* Ícone de configurações fixo no topo direito */}
          <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50">
            <ConfigModal count={count} onChanged={force} />
          </div>

          {/* Título central em duas linhas, data e instrução */}
          <div className="mt-4 text-center">
            <h1 className="text-3xl md:text-4xl font-bold leading-snug">
              Registro de Preços Diário
            </h1>
            <div className="mt-3 flex justify-center">
              <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5 text-sm md:text-base">
                <CalendarDays className="size-4" aria-hidden="true" />
                <span>Hoje: {today}</span>
              </Badge>
            </div>
            <p className="mt-2 text-center text-muted-foreground text-sm md:text-base">
              Selecione o período e preencha as informações abaixo.
            </p>
          </div>
        </div>
      </header>

      <section className="container mx-auto pb-12">
        <Tabs defaultValue="manha" className="w-full mt-8 md:mt-10">
          <TabsList className="mx-auto inline-flex items-center rounded-full border bg-background/90 supports-[backdrop-filter]:bg-background/70 backdrop-blur p-1.5 shadow-sm gap-1">
            <TabsTrigger
              value="manha"
              className="rounded-full px-7 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Sun className="size-4" aria-hidden="true" />
              <span>Manhã</span>
            </TabsTrigger>
            <TabsTrigger
              value="tarde"
              className="rounded-full px-7 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-brand-gold data-[state=active]:text-brand-gold-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Sunset className="size-4" aria-hidden="true" />
              <span>Tarde</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manha" className="mt-6">
            <PriceForm period="manha" />
          </TabsContent>
          <TabsContent value="tarde" className="mt-6">
            <PriceForm period="tarde" />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default Index;
