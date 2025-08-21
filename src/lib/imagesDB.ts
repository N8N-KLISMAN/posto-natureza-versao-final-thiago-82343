export type ImageKey = string; // ex: "img:manha:reference"
export type MetadataKey = string; // ex: "meta:manha:reference"

export const imageKey = (period: string, stationId: string): ImageKey =>
  `img:${period}:${stationId}`;

export const metadataKey = (period: string, stationId: string): MetadataKey =>
  `meta:${period}:${stationId}`;

// Sistema de armazenamento híbrido (localStorage + sessionStorage fallback)
export async function saveImageBlob(key: ImageKey, blob: Blob, metadata?: any) {
  try {
    const dataURL = await blobToDataURL(blob);
    const base64 = await dataURLToBase64(dataURL);
    
    // Tenta localStorage primeiro
    try {
      localStorage.setItem(key, base64);
      if (metadata) {
        const metaKey = key.replace('img:', 'meta:');
        localStorage.setItem(metaKey, JSON.stringify(metadata));
      }
    } catch (e) {
      // Se localStorage falhou, tenta sessionStorage
      console.warn('LocalStorage full, using sessionStorage fallback');
      sessionStorage.setItem(key, base64);
      if (metadata) {
        const metaKey = key.replace('img:', 'meta:');
        sessionStorage.setItem(metaKey, JSON.stringify(metadata));
      }
    }
  } catch (e) {
    console.error('Failed to save image:', e);
    throw new Error('Não foi possível salvar a imagem');
  }
}

export async function getImageBlob(key: ImageKey): Promise<Blob | undefined> {
  try {
    // Tenta localStorage primeiro, depois sessionStorage
    const base64 = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!base64) return undefined;
    
    // Converte base64 de volta para blob
    const dataURL = `data:image/jpeg;base64,${base64}`;
    const response = await fetch(dataURL);
    return await response.blob();
  } catch (e) {
    console.error('Failed to get image:', e);
    return undefined;
  }
}

export async function getImageMetadata(key: ImageKey): Promise<any> {
  try {
    const metaKey = key.replace('img:', 'meta:');
    const metaData = localStorage.getItem(metaKey) || sessionStorage.getItem(metaKey);
    if (!metaData) return undefined;
    return JSON.parse(metaData);
  } catch (e) {
    console.error('Failed to get image metadata:', e);
    return undefined;
  }
}

export async function removeImageBlob(key: ImageKey) {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    const metaKey = key.replace('img:', 'meta:');
    localStorage.removeItem(metaKey);
    sessionStorage.removeItem(metaKey);
  } catch (e) {
    console.error('Failed to remove image:', e);
  }
}

export async function blobToDataURL(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBase64(dataURL: string): Promise<string> {
  return dataURL.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
}

// Compressão ultra agressiva para economizar armazenamento
export async function compressImage(file: File, maxSize = 600): Promise<Blob> {
  try {
    const img = document.createElement('img');
    const dataURL = await blobToDataURL(file);
    
    await new Promise((res, rej) => {
      img.onload = () => res(null);
      img.onerror = rej;
      img.src = dataURL;
    });

    // Redução agressiva do tamanho
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    
    const ctx = canvas.getContext('2d')!;
    // Suavização para melhor qualidade em tamanhos menores
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Compressão ultra agressiva (qualidade 0.5)
    const out = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), 'image/jpeg', 0.5)
    );
    
    return out;
  } catch (e) {
    console.error('Image compression failed:', e);
    throw new Error('Falha na compressão da imagem');
  }
}

// Função para limpar cache quando necessário
export function clearImageCache() {
  try {
    const imageKeys = Object.keys(localStorage).filter(key => key.startsWith('img:'));
    const metaKeys = Object.keys(localStorage).filter(key => key.startsWith('meta:'));
    imageKeys.forEach(key => localStorage.removeItem(key));
    metaKeys.forEach(key => localStorage.removeItem(key));
    
    const sessionImageKeys = Object.keys(sessionStorage).filter(key => key.startsWith('img:'));
    const sessionMetaKeys = Object.keys(sessionStorage).filter(key => key.startsWith('meta:'));
    sessionImageKeys.forEach(key => sessionStorage.removeItem(key));
    sessionMetaKeys.forEach(key => sessionStorage.removeItem(key));
    
    console.log(`Cleared ${imageKeys.length + metaKeys.length + sessionImageKeys.length + sessionMetaKeys.length} cached items`);
  } catch (e) {
    console.error('Failed to clear image cache:', e);
  }
}

// Verifica espaço disponível aproximado
export function getStorageInfo() {
  try {
    const localStorageSize = new Blob(Object.values(localStorage)).size;
    const sessionStorageSize = new Blob(Object.values(sessionStorage)).size;
    
    return {
      localStorage: {
        used: Math.round(localStorageSize / 1024), // KB
        available: true
      },
      sessionStorage: {
        used: Math.round(sessionStorageSize / 1024), // KB  
        available: true
      }
    };
  } catch (e) {
    return {
      localStorage: { used: 0, available: false },
      sessionStorage: { used: 0, available: false }
    };
  }
}