import React from 'react';
import { Camera, X as XIcon, Image, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateImageDate, extractImageMetadata } from "@/lib/imageMetadata";
import { saveImageBlob, imageKey, compressImage, getImageBlob, removeImageBlob, getImageMetadata, blobToDataURL, dataURLToBase64 } from "@/lib/imagesDB";

interface Props {
  period: string;
  stationId: string;               // ex: "reference" | "competitor_1"
  label: string;                   // ex: "Tirar foto da placa do Posto Natureza"
  valueBase64?: string;            // station.photoBase64
  onBase64: (b64: string) => void; // atualiza estado/localStorage existente
  onClear?: () => void;            // limpa estado do card (opcional)
  allowGallery?: boolean;          // permite selecionar da galeria além da câmera
  onMetadata?: (metadata: any) => void; // callback para metadados
}

export const ImageCapture: React.FC<Props> = ({ period, stationId, label, valueBase64, onBase64, onClear, allowGallery = false, onMetadata }) => {
  const [preview, setPreview] = React.useState<string | undefined>(valueBase64);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [validationSuggestion, setValidationSuggestion] = React.useState<string | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const key = React.useMemo(() => imageKey(period, stationId), [period, stationId]);

  // Hidrata preview desde o IDB caso o estado esteja vazio
  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!preview) {
        const blob = await getImageBlob(key);
        if (blob && active) {
          const dataURL = await blobToDataURL(blob);
          const base64 = await dataURLToBase64(dataURL);
          setPreview(dataURL);
          onBase64(base64);
          
          // Load metadata too
          const metadata = await getImageMetadata(key);
          if (metadata) {
            onMetadata?.(metadata);
          }
        }
      }
    })();
    return () => { active = false; };
  }, [key, preview, onBase64, onMetadata]);

  // Se o estado externo mudar (ex.: limpar), refletir no preview
  React.useEffect(() => {
    if (valueBase64) {
      // Se tem base64, converte para dataURL para preview
      let mime = "image/jpeg";
      if (valueBase64.startsWith("iVBORw0KGgo")) mime = "image/png";
      else if (valueBase64.startsWith("UklGR")) mime = "image/webp";
      const dataURL = `data:${mime};base64,${valueBase64}`;
      setPreview(dataURL);
    } else {
      setPreview(undefined);
    }
  }, [valueBase64]);

  const handlePick = async (file: File, source: 'camera' | 'gallery' = 'camera') => {
    setIsProcessing(true);
    setValidationError(null);
    setValidationSuggestion(null);
    
    try {
      let metadata: any = {};
      
      // Extrai metadados EXIF
      const exifMetadata = await extractImageMetadata(file);
      if (exifMetadata) {
        metadata = {
          dateTime: exifMetadata.dateTime?.toISOString(),
          make: exifMetadata.make,
          model: exifMetadata.model,
          software: exifMetadata.software,
          gps: exifMetadata.gps
        };
      }

      // Para imagens da galeria em concorrentes, validar metadados
      if (source === 'gallery' && stationId.startsWith("competitor_")) {
        const validation = await validateImageDate(file, stationId);
        
        if (!validation.isValid) {
          setValidationError(validation.reason || 'Imagem inválida');
          setValidationSuggestion(validation.suggestion || 'Use a câmera para tirar uma foto atual');
          setIsProcessing(false);
          return;
        }
        
        // Adiciona status de validação aos metadados
        metadata.validationStatus = validation.status || 'validated';
        metadata.validationReason = validation.reason;
      } else {
        // Para posts de referência, sempre valida
        metadata.validationStatus = 'validated';
      }

      // Compressão ultra agressiva (600px, qualidade 0.5)
      const blob = await compressImage(file, 600);
      
      // Salva no armazenamento híbrido (localStorage/sessionStorage) com metadata
      await saveImageBlob(key, blob, metadata);
      
      // Prepara preview e base64
      const dataURL = await blobToDataURL(blob);
      const base64 = await dataURLToBase64(dataURL);
      
      setPreview(dataURL);
      onBase64(base64);
      onMetadata?.(metadata);
    } catch (e) {
      console.error('Erro ao processar imagem:', e);
      setValidationError('Erro ao processar a imagem');
      setValidationSuggestion('Tente novamente');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handlePick(f, 'camera');
    // limpa o valor do input para permitir o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleGalleryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handlePick(f, 'gallery');
    // limpa o valor do input para permitir o mesmo arquivo novamente
    e.target.value = '';
  };

  const clear = async () => {
    await removeImageBlob(key);
    onBase64('');
    setPreview(undefined);
    setValidationError(null);
    setValidationSuggestion(null);
    onClear?.();
  };

  return (
    <div className="w-full">
      {/* Mensagem de erro de validação */}
      {validationError && (
        <Alert className="mb-4 border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>{validationError}</strong>
            {validationSuggestion && (
              <span className="block mt-1 text-muted-foreground">
                {validationSuggestion}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!preview ? (
        allowGallery ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">{label}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2"
                disabled={isProcessing}
                onClick={() => !isProcessing && cameraInputRef.current?.click()}
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">Tirar Foto</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2"
                disabled={isProcessing}
                onClick={() => !isProcessing && galleryInputRef.current?.click()}
              >
                <Image className="h-5 w-5" />
                <span className="text-xs">Galeria</span>
              </Button>
            </div>
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Processando...</span>
              </div>
            )}
          </div>
        ) : (
          <div
            role="button"
            className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-accent/50"
            onClick={() => !isProcessing && cameraInputRef.current?.click()}
          >
            {isProcessing ? (
              <div className="mx-auto h-5 w-5 mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Camera className="mx-auto h-5 w-5 mb-2" />
            )}
            <p className="text-sm">{isProcessing ? 'Processando...' : 'Tirar Foto'}</p>
          </div>
        )
      ) : (
        <div className="relative inline-block">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Visualizar foto"
                className="relative block rounded-md overflow-hidden border"
              >
                <img
                  src={preview}
                  alt={`Foto da placa`}
                  loading="lazy"
                  className="h-24 w-40 object-cover"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[90vw]">
              <img
                src={preview}
                alt={`Foto da placa`}
                className="w-full h-auto rounded-md"
              />
            </DialogContent>
          </Dialog>
          <button
            type="button"
            aria-label="Remover foto"
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow ring-1 ring-background/60"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}
      
      {/* Input para câmera */}
      <input
        key={`camera-${stationId}-${preview ? "has" : "empty"}`}
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraInput}
      />
      
      {/* Input para galeria (apenas se allowGallery for true) */}
      {allowGallery && (
        <input
          key={`gallery-${stationId}-${preview ? "has" : "empty"}`}
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryInput}
        />
      )}
    </div>
  );
};