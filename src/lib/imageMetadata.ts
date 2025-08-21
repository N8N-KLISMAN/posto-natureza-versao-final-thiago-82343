import exifr from 'exifr';
import { format, isToday, isYesterday } from 'date-fns';

export interface ImageMetadata {
  dateTime?: Date;
  make?: string;
  model?: string;
  software?: string;
  gps?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  metadata?: ImageMetadata;
  suggestion?: string;
  status?: 'validated' | 'invalid' | 'warning';
}

/**
 * Extrai metadados EXIF da imagem
 */
export const extractImageMetadata = async (file: File): Promise<ImageMetadata | null> => {
  try {
    const exifData = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'DateTime', 'CreateDate', 'Make', 'Model', 'Software', 'GPS']
    });

    if (!exifData) return null;

    const dateTime = exifData.DateTimeOriginal || exifData.DateTime || exifData.CreateDate;
    
    return {
      dateTime: dateTime ? new Date(dateTime) : undefined,
      make: exifData.Make,
      model: exifData.Model,
      software: exifData.Software,
      gps: exifData.GPS ? {
        latitude: exifData.GPS.latitude,
        longitude: exifData.GPS.longitude
      } : undefined
    };
  } catch (error) {
    console.warn('Erro ao extrair metadados EXIF:', error);
    return null;
  }
};

/**
 * Valida se a imagem foi tirada no dia atual (para concorrentes)
 */
export const validateImageDate = async (file: File, stationId: string): Promise<ValidationResult> => {
  // Posto de referência não precisa de validação
  if (stationId === "reference") {
    return { isValid: true };
  }

  // Apenas concorrentes precisam de validação
  if (!stationId.startsWith("competitor_")) {
    return { isValid: true };
  }

  try {
    const metadata = await extractImageMetadata(file);
    
    if (!metadata) {
      return {
        isValid: false,
        reason: "Não foi possível verificar os metadados da imagem",
        suggestion: "Use a câmera para tirar uma foto atual",
        status: 'invalid'
      };
    }

    if (!metadata.dateTime) {
      return {
        isValid: false,
        reason: "Não foi possível verificar a data da imagem",
        suggestion: "Use a câmera para tirar uma foto atual",
        status: 'invalid'
      };
    }

    // Verifica se a foto foi tirada apenas hoje (sem tolerância)
    const photoDate = metadata.dateTime;
    const isTodayPhoto = isToday(photoDate);

    if (!isTodayPhoto) {
      const photoDateFormatted = format(photoDate, 'dd/MM/yyyy');
      return {
        isValid: false,
        reason: `Esta imagem foi tirada em ${photoDateFormatted}, não no dia atual`,
        suggestion: "Use a câmera para tirar uma foto atual",
        metadata,
        status: 'invalid'
      };
    }

    return {
      isValid: true,
      metadata,
      status: 'validated'
    };

  } catch (error) {
    console.warn('Erro na validação de data da imagem:', error);
    return {
      isValid: false,
      reason: "Erro ao processar a imagem",
      suggestion: "Tente novamente ou use a câmera",
      status: 'invalid'
    };
  }
};

/**
 * Formata informações dos metadados para exibição
 */
export const formatMetadataInfo = (metadata: ImageMetadata): string => {
  const parts: string[] = [];
  
  if (metadata.dateTime) {
    parts.push(`Data: ${format(metadata.dateTime, 'dd/MM/yyyy HH:mm')}`);
  }
  
  if (metadata.make && metadata.model) {
    parts.push(`Dispositivo: ${metadata.make} ${metadata.model}`);
  }
  
  return parts.join(' • ');
};