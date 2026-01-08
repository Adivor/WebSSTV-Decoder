
import { SSTVModeId, SSTVModeConfig } from './types';

export const MODES: Record<string, SSTVModeConfig> = {
  [SSTVModeId.MARTIN1]: {
    id: SSTVModeId.MARTIN1,
    width: 320,
    height: 256,
    channelTime: 146.432,
    syncTime: 4.862,
    gapTime: 0.572,
    numChannels: 3,
    colorOrder: ['G', 'B', 'R']
  },
  [SSTVModeId.MARTIN2]: {
    id: SSTVModeId.MARTIN2,
    width: 320,
    height: 256,
    channelTime: 73.216,
    syncTime: 4.862,
    gapTime: 0.572,
    numChannels: 3,
    colorOrder: ['G', 'B', 'R']
  },
  [SSTVModeId.SCOTTIE1]: {
    id: SSTVModeId.SCOTTIE1,
    width: 320,
    height: 256,
    channelTime: 138.240,
    syncTime: 9.0,
    gapTime: 1.5,
    numChannels: 3,
    colorOrder: ['R', 'G', 'B']
  },
  [SSTVModeId.ROBOT36]: {
    id: SSTVModeId.ROBOT36,
    width: 320,
    height: 240,
    channelTime: 88, // Semplificato per Y/C
    syncTime: 9.0,
    gapTime: 1.5,
    numChannels: 2, // Y + UV (interleaved)
    colorOrder: ['G', 'B'] // Placeholder
  }
};

export const FREQ_BLACK = 1500;
export const FREQ_WHITE = 2300;
export const FREQ_SYNC = 1200;
export const FREQ_VIS_LEADER = 1900;
