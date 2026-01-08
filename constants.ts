
import { SSTVModeId, SSTVModeConfig } from './types';

export const MODES: Record<string, SSTVModeConfig> = {
  [SSTVModeId.MARTIN1]: {
    id: SSTVModeId.MARTIN1,
    width: 320,
    height: 256,
    lineTime: 146.432,
    syncTime: 4.862,
    numChannels: 3,
    visCode: 44
  },
  [SSTVModeId.MARTIN2]: {
    id: SSTVModeId.MARTIN2,
    width: 320,
    height: 256,
    lineTime: 73.216,
    syncTime: 4.862,
    numChannels: 3,
    visCode: 40
  },
  [SSTVModeId.SCOTTIE1]: {
    id: SSTVModeId.SCOTTIE1,
    width: 320,
    height: 256,
    lineTime: 138.240,
    syncTime: 9.0,
    numChannels: 3,
    visCode: 60
  },
  [SSTVModeId.SCOTTIE2]: {
    id: SSTVModeId.SCOTTIE2,
    width: 320,
    height: 256,
    lineTime: 72.032,
    syncTime: 9.0,
    numChannels: 3,
    visCode: 56
  },
  [SSTVModeId.ROBOT36]: {
    id: SSTVModeId.ROBOT36,
    width: 320,
    height: 240,
    lineTime: 150,
    syncTime: 9.0,
    numChannels: 3,
    visCode: 8
  },
  [SSTVModeId.PD120]: {
    id: SSTVModeId.PD120,
    width: 640,
    height: 480,
    lineTime: 250,
    syncTime: 20,
    numChannels: 3,
    visCode: 95
  }
};

export const FREQ_BLACK = 1500;
export const FREQ_WHITE = 2300;
export const FREQ_SYNC = 1200;
export const FREQ_VIS_LEADER = 1900;
export const FREQ_VIS_BIT0 = 1300;
export const FREQ_VIS_BIT1 = 1100;
