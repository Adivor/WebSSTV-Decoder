
export enum SSTVModeId {
  MARTIN1 = 'Martin 1',
  MARTIN2 = 'Martin 2',
  SCOTTIE1 = 'Scottie 1',
  SCOTTIE2 = 'Scottie 2',
  ROBOT36 = 'Robot 36',
  PD120 = 'PD 120',
  AUTO = 'AUTO'
}

export interface SSTVModeConfig {
  id: SSTVModeId;
  width: number;
  height: number;
  channelTime: number; // ms per singolo colore
  syncTime: number; // ms impulso sincro
  gapTime: number; // ms gap tra canali
  numChannels: number;
  colorOrder: ('R' | 'G' | 'B')[];
}

export enum DecoderStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING...',
  SYNCING = 'SYNCING...',
  RECEIVING = 'RECEIVING'
}

export interface SignalData {
  frequency: number;
  level: number;
}

export interface AIAnalysisResult {
  callsign?: string;
  operatorName?: string;
  location?: string;
  gridLocator?: string;
  report?: string;
  frequency?: string;
  mode?: string;
  technicalDetails?: string;
  otherInfo?: string;
  rawSummary?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  dataUrl: string;
  cleanedDataUrl?: string; // Immagine processata dall'IA
  mode: SSTVModeId;
  aiAnalysis?: AIAnalysisResult;
}
