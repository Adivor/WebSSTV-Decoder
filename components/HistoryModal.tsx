
import React, { useState } from 'react';
import { HistoryItem } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: HistoryItem[];
  onDelete: (id: string) => void;
  onDownload: (item: HistoryItem) => void;
  onClear: () => void;
  onAnalyze: (item: HistoryItem) => void;
  onClean: (item: HistoryItem) => void;
  analyzingId: string | null;
  cleaningId: string | null;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen, onClose, items, onDelete, onDownload, onClear, onAnalyze, onClean, analyzingId, cleaningId
}) => {
  if (!isOpen) return null;

  const openQRZ = (callsign: string) => {
    window.open(`https://www.qrz.com/db/${callsign}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#111827] border-2 border-gray-700 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-2xl">📡</span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Signal Archive</h2>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">DSP Intelligence Enabled</p>
            </div>
          </div>
          <div className="flex gap-3">
            {items.length > 0 && (
              <button onClick={onClear} className="px-3 py-1 bg-red-900/20 border border-red-500/50 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-900/40 transition-all">PURGE ALL</button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:bg-gray-700 transition-all">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f1a]">
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-600">
              <span className="text-4xl opacity-10 mb-4">📺</span>
              <p className="text-sm font-bold opacity-30">ARCHIVE EMPTY</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div key={item.id} className="group flex flex-col bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden hover:border-blue-500/40 transition-all duration-300">
                  <div className="relative aspect-[4/3] bg-black">
                    <img 
                      src={item.cleanedDataUrl || item.dataUrl} 
                      className={`w-full h-full object-contain image-pixelated ${item.cleanedDataUrl ? 'border-2 border-cyan-500/20' : ''}`} 
                      alt="SSTV" 
                    />
                    
                    {cleaningId === item.id && (
                      <div className="absolute inset-0 bg-cyan-600/20 backdrop-blur-md flex items-center justify-center z-20">
                        <div className="w-full h-0.5 bg-cyan-400 absolute top-0 animate-[scan_2s_infinite] shadow-[0_0_20px_cyan]"></div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                          <span className="text-[10px] font-black text-cyan-400 bg-black/60 px-3 py-1 rounded-full uppercase tracking-widest">IA DENOISING...</span>
                        </div>
                      </div>
                    )}

                    {analyzingId === item.id && (
                      <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-sm flex items-center justify-center z-10">
                        <div className="w-full h-0.5 bg-blue-400 absolute top-0 animate-[scan_1.5s_infinite] shadow-[0_0_15px_blue]"></div>
                        <span className="text-[10px] font-black text-blue-400 bg-black/60 px-3 py-1 rounded-full uppercase tracking-widest">SCANNING DATA...</span>
                      </div>
                    )}

                    {item.cleanedDataUrl && (
                      <div className="absolute top-2 left-2 bg-cyan-600 text-[8px] font-black text-white px-2 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                        AI IMPROVED ✨
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    {item.aiAnalysis ? (
                      <div className="mb-3 p-3 bg-blue-900/10 rounded-lg border border-blue-500/20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] text-blue-400 font-bold uppercase">Callsign</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-mono font-bold text-white">{item.aiAnalysis.callsign || '??'}</span>
                              {item.aiAnalysis.callsign && <button onClick={() => openQRZ(item.aiAnalysis!.callsign!)} className="text-xs hover:scale-110 transition-transform">🌐</button>}
                            </div>
                          </div>
                          {item.aiAnalysis.report && <div className="text-right"><span className="text-[8px] text-green-500 font-bold uppercase block">RST</span><span className="text-lg font-mono text-green-400">{item.aiAnalysis.report}</span></div>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px] text-gray-400 border-t border-gray-800 pt-2">
                          <div>Freq: <span className="text-blue-200">{item.aiAnalysis.frequency || 'N/A'}</span></div>
                          <div>Mode: <span className="text-amber-400">{item.aiAnalysis.mode || 'N/A'}</span></div>
                          <div className="col-span-2">Loc: <span className="text-gray-300">{item.aiAnalysis.location || 'Unknown'}</span></div>
                          {item.aiAnalysis.gridLocator && (
                            <div className="col-span-2 text-cyan-400 font-bold">Grid: <span>{item.aiAnalysis.gridLocator}</span></div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3 h-16 bg-gray-800/20 rounded-lg flex items-center justify-center italic text-[9px] text-gray-600 border border-dashed border-gray-800">IA analysis available</div>
                    )}

                    <div className="flex justify-between items-center text-[9px] text-gray-500 mb-4 font-mono">
                      <span className="bg-gray-800 px-2 py-0.5 rounded uppercase tracking-tighter">{item.mode}</span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => onClean(item)} 
                          disabled={!!cleaningId || !!item.cleanedDataUrl}
                          className={`text-[9px] font-black py-2 rounded-lg border transition-all ${item.cleanedDataUrl ? 'bg-cyan-900/20 text-cyan-500 border-cyan-500/30' : 'bg-cyan-600 text-white border-cyan-500/50 hover:bg-cyan-500 hover:shadow-[0_0_10px_rgba(8,145,178,0.4)] disabled:opacity-50'}`}
                        >
                          {item.cleanedDataUrl ? '✨ PULITA' : '✨ PULISCI IA'}
                        </button>
                        <button 
                          onClick={() => onAnalyze(item)} 
                          disabled={!!analyzingId || !!item.aiAnalysis}
                          className={`text-[9px] font-black py-2 rounded-lg border transition-all ${item.aiAnalysis ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-blue-600 text-white border-blue-500/50 hover:bg-blue-500 disabled:opacity-50'}`}
                        >
                          {item.aiAnalysis ? '✓ ANALIZZATA' : '🔍 ANALISI IA'}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => onDownload(item)} className="flex-1 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
                          💾 SALVA
                        </button>
                        <button onClick={() => onDelete(item.id)} className="w-10 flex items-center justify-center bg-gray-800 text-red-500 rounded-lg text-xs hover:bg-red-900/20 transition-all">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
    </div>
  );
};
