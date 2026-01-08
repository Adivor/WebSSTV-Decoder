
import React from 'react';
import { HistoryItem } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: HistoryItem[];
  onDelete: (id: string) => void;
  onDownload: (item: HistoryItem) => void;
  onClear: () => void;
  onAnalyze: (item: HistoryItem) => void;
  analyzingId: string | null;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen, onClose, items, onDelete, onDownload, onClear, onAnalyze, analyzingId
}) => {
  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openQRZ = (callsign: string) => {
    window.open(`https://www.qrz.com/db/${callsign}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#111827] border-2 border-gray-700 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-xl">📡</span>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Image Archive</h2>
              <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest">AI Intelligence Active</p>
            </div>
          </div>
          <div className="flex gap-3">
            {items.length > 0 && <button onClick={onClear} className="px-3 py-1 bg-red-900/20 border border-red-500/50 text-red-400 text-[10px] font-bold rounded">PURGE</button>}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f1a]">
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-600">
              <span className="text-4xl opacity-20 mb-4">📺</span>
              <p>No images stored.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div key={item.id} className="group flex flex-col bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden hover:border-blue-500/40 transition-all">
                  <div className="relative aspect-[4/3] bg-black">
                    <img src={item.dataUrl} className="w-full h-full object-contain image-pixelated" alt="Decode" />
                    {analyzingId === item.id && (
                      <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-sm flex items-center justify-center">
                        <div className="w-full h-0.5 bg-blue-400 absolute top-0 animate-[scan_1.5s_infinite]"></div>
                        <span className="text-[10px] font-bold text-blue-400 bg-black/60 px-2 py-1 rounded">AI SCANNING...</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    {item.aiAnalysis ? (
                      <div className="mb-3 p-3 bg-blue-900/10 rounded-lg border border-blue-500/20 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[8px] text-blue-400 font-bold uppercase">Callsign</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-mono font-bold text-white">{item.aiAnalysis.callsign || 'N/A'}</span>
                              {item.aiAnalysis.callsign && (
                                <button onClick={() => openQRZ(item.aiAnalysis!.callsign!)} className="text-xs">🌐</button>
                              )}
                            </div>
                          </div>
                          {item.aiAnalysis.report && <div className="text-right"><span className="text-[8px] text-green-500 font-bold uppercase block">RST</span><span className="text-lg font-mono text-green-400">{item.aiAnalysis.report}</span></div>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                          {item.aiAnalysis.frequency && <div>Freq: <span className="text-blue-200">{item.aiAnalysis.frequency}</span></div>}
                          {item.aiAnalysis.mode && <div>Mode: <span className="text-amber-300">{item.aiAnalysis.mode}</span></div>}
                          {item.aiAnalysis.location && <div className="col-span-2">Loc: {item.aiAnalysis.location}</div>}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3 h-24 bg-gray-800/30 rounded-lg flex items-center justify-center italic text-[9px] text-gray-600">Pending AI Vision Scan</div>
                    )}

                    <div className="flex justify-between text-[9px] text-gray-500 mb-4 uppercase">
                      <span>{item.mode}</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => onAnalyze(item)} disabled={!!analyzingId || !!item.aiAnalysis}
                        className={`text-[9px] font-bold py-2 rounded border ${item.aiAnalysis ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-blue-600 text-white border-blue-400/50'}`}
                      >
                        {item.aiAnalysis ? '✓ ANALYZED' : '✨ AI SCAN'}
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => onDownload(item)} className="flex-1 bg-gray-800 text-white rounded text-xs">💾</button>
                        <button onClick={() => onDelete(item.id)} className="flex-1 bg-gray-800 text-red-500 rounded text-xs">🗑</button>
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
