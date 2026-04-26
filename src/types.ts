export interface ImageMetadata {
  id: string;
  fileName: string;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: GeneratedMetadata;
  error?: string;
}

export interface GeneratedMetadata {
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
  isEditorial: boolean;
  isMature: boolean;
  isIllustration: boolean;
  analysis: {
    objects: string[];
    sceneType: string;
    composition: string;
    colors: string[];
  };
}

export enum StockMarketplace {
  SHUTTERSTOCK = 'shutterstock',
  ADOBE_STOCK = 'adobe_stock',
  FREEPIK = 'freepik',
}
