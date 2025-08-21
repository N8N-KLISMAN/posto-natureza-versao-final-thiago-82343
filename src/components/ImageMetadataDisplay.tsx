import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Camera, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImageMetadata {
  dateTime?: string;
  make?: string;
  model?: string;  
  software?: string;
  gps?: {
    latitude?: number;
    longitude?: number;
  };
  validationStatus?: 'validated' | 'invalid' | 'warning';
  validationReason?: string;
}

interface ImageMetadataDisplayProps {
  metadata?: ImageMetadata;
  className?: string;
}

export const ImageMetadataDisplay: React.FC<ImageMetadataDisplayProps> = ({ 
  metadata, 
  className = '' 
}) => {
  if (!metadata) return null;

  const getStatusIcon = () => {
    switch (metadata.validationStatus) {
      case 'validated':
        return <CheckCircle className="size-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="size-4 text-warning" />;
      case 'invalid':
        return <XCircle className="size-4 text-destructive" />;
      default:
        return <Camera className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (metadata.validationStatus) {
      case 'validated':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'invalid':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-border';
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      const date = new Date(dateTimeString);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return dateTimeString;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Status Badge */}
      <Badge 
        variant="outline" 
        className={`inline-flex items-center gap-2 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        <span className="text-xs font-medium">
          {metadata.validationStatus === 'validated' && 'Foto validada'}
          {metadata.validationStatus === 'warning' && 'Aviso na validação'}
          {metadata.validationStatus === 'invalid' && 'Foto inválida'}
          {!metadata.validationStatus && 'Metadados carregados'}
        </span>
      </Badge>

      {/* Metadata Details */}
      <div className="grid gap-1 text-xs text-muted-foreground">
        {metadata.dateTime && (
          <div className="flex items-center gap-2">
            <Clock className="size-3" />
            <span>Tirada em: {formatDateTime(metadata.dateTime)}</span>
          </div>
        )}
        {metadata.make && metadata.model && (
          <div className="flex items-center gap-2">
            <Camera className="size-3" />
            <span>Dispositivo: {metadata.make} {metadata.model}</span>
          </div>
        )}
        {metadata.gps?.latitude && metadata.gps?.longitude && (
          <div className="flex items-center gap-2">
            <MapPin className="size-3" />
            <span>Localização GPS detectada</span>
          </div>
        )}
      </div>

      {/* Validation Message */}
      {metadata.validationReason && (
        <div className={`text-xs p-2 rounded-md ${
          metadata.validationStatus === 'invalid' 
            ? 'bg-destructive/10 text-destructive' 
            : 'bg-muted/10 text-muted-foreground'
        }`}>
          {metadata.validationReason}
        </div>
      )}
    </div>
  );
};