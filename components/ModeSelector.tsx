
import React from 'react';
import { SSTVModeId } from '../types';

interface ModeSelectorProps {
  selectedMode: SSTVModeId;
  onSelect: (mode: SSTVModeId) => void;
  status: string;
  afcEnabled: boolean;
  onToggleAfc: () => void;
  lmsEnabled: boolean;
  onToggleLms: () => void;
  bpfEnabled: boolean;
  onToggleBpf: () => void;
  bpfWidth: 'narrow' | 'medium' | 'wide';
  onChangeBpfWidth: (width: 'narrow' | 'medium' | 'wide') => void;
  noiseReductionEnabled: boolean;
  onToggleNoiseReduction: () => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ 
  selectedMode, 
  onSelect, 
  status, 
  afcEnabled, 
  onToggleAfc,
  lmsEnabled,
  onToggleLms,
  bpfEnabled,
  onToggleBpf,
  bpfWidth,
  onChangeBpfWidth,
  noiseReductionEnabled,
  onToggleNoiseReduction
}) => {
  const modes = [
    SSTVModeId.ROBOT36,
    SSTVModeId.MARTIN1,
    SSTVModeId.MARTIN2,
    SSTVModeId.SCOTTIE1,
    SSTVModeId.PD120
  ];

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400">RX OPTIONS</span>
        <span className={`text-xs px-2 py-0.5 rounded font-bold ${status.includes('IDLE') ? 'bg-gray-700 text-gray-400' : 'bg-green-900 text-green-400 animate-pulse'}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onSelect(m)}
            className={`px-3 py-2 text-xs font-bold border transition-all rounded shadow-sm ${
              selectedMode === m
                ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/50'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {m}
          </button>
        ))}
        <button
          onClick={() => onSelect(SSTVModeId.AUTO)}
          className={`col-span-2 px-3 py-2 text-xs font-bold border transition-all rounded shadow-sm ${
            selectedMode === SSTVModeId.AUTO
              ? 'bg-amber-600 border-amber-400 text-white shadow-amber-900/50'
              : 'bg-gray-800 border-gray-700 text-amber-500 hover:bg-gray-700'
          }`}
        >
          AUTO DETECT
        </button>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <div className="flex gap-2">
          <button 
            onClick={onToggleAfc}
            className={`flex-1 border text-[10px] py-1 rounded transition-colors font-bold ${
              afcEnabled 
                ? 'bg-green-600 border-green-400 text-white' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
          >
            AFC {afcEnabled ? 'ON' : 'OFF'}
          </button>
          <button 
            onClick={onToggleLms}
            className={`flex-1 border text-[10px] py-1 rounded transition-colors font-bold ${
              lmsEnabled 
                ? 'bg-purple-600 border-purple-400 text-white' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
          >
            LMS {lmsEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <button 
          onClick={onToggleNoiseReduction}
          className={`w-full border text-[10px] py-1 rounded transition-colors font-bold ${
            noiseReductionEnabled 
              ? 'bg-cyan-600 border-cyan-400 text-white' 
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          NOISE REDUCTION (LPF) {noiseReductionEnabled ? 'ON' : 'OFF'}
        </button>

        <div className="flex flex-col gap-1 border border-gray-800 p-1.5 rounded bg-black/20">
          <button 
            onClick={onToggleBpf}
            className={`w-full border text-[10px] py-1 rounded transition-colors font-bold ${
              bpfEnabled 
                ? 'bg-blue-600 border-blue-400 text-white' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
          >
            BAND PASS FILTER {bpfEnabled ? 'ACTIVE' : 'OFF'}
          </button>
          
          {bpfEnabled && (
            <div className="flex gap-1 mt-1">
              {(['narrow', 'medium', 'wide'] as const).map(w => (
                <button
                  key={w}
                  onClick={() => onChangeBpfWidth(w)}
                  className={`flex-1 text-[8px] py-0.5 rounded border uppercase transition-all ${
                    bpfWidth === w 
                      ? 'bg-blue-900 border-blue-500 text-blue-200' 
                      : 'bg-gray-900 border-gray-800 text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
