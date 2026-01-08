
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
  isOpen,
  onClose,
  items,
  onDelete,
  onDownload,
  onClear,
  onAnalyze,
  analyzingId
}) => {
  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple visual feedback could be added here if needed
  };

  const openQRZ = (callsign: string) => {
    window.open(`https://www.qrz.com/db/${callsign}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#111827] border-2 border-gray-700 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-900 px-6 py-5 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-xl border border-blue-500/30">
              📡
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Image Archive</h2>
              <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                AI-Powered Radio Intelligence Enabled
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {items.length > 0 && (
              <button 
                onClick={onClear}
                className="px-4 py-2 bg-red-900/20 border border-red-500/50 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-900/40 transition-all uppercase tracking-tighter"
              >
                Purge Database
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#0a0f1a]">
          {items.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-3xl">
              <div className="text-6xl mb-6 opacity-10">📺</div>
              <p className="text-lg font-medium opacity-50">No decoded signals stored in local buffer.</p>
              <button onClick={onClose} className="mt-4 text-blue-500 text-sm hover:underline">Return to Receiver</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item) => (
                <div key={item.id} className="group flex flex-col bg-gray-900/50 rounded-2xl border border-gray-800 hover:border-blue-500/40 transition-all duration-300 overflow-hidden shadow-xl">
                  
                  {/* Image Section */}
                  <div className="relative aspect-[4/3] bg-black group-hover:scale-[1.02] transition-transform duration-500">
                    <img 
                      src={item.dataUrl} 
                      alt="SSTV Data" 
                      className="w-full h-full object-contain image-pixelated"
                    />
                    
                    {/* Scanning Animation */}
                    {analyzingId === item.id && (
                      <div className="absolute inset-0 z-20 overflow-hidden">
                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute top-0 animate-[scan_1.5s_infinite] shadow-[0_0_20px_rgba(59,130,246,1)]"></div>
                        <div className="absolute inset-0 bg-blue-600/5 backdrop-blur-[2px]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="px-4 py-2 bg-black/80 rounded-full border border-blue-500/50 flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                            <span className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">Deep Vision Scan...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Results Section */}
                  <div className="p-5 flex-1 flex flex-col">
                    {item.aiAnalysis ? (
                      <div className="mb-4 p-4 bg-blue-900/10 rounded-xl border border-blue-500/20 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest opacity-70">Station ID</span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-mono font-bold text-white tracking-tighter">
                                {item.aiAnalysis.callsign || 'Unknown'}
                              </span>
                              {item.aiAnalysis.callsign && (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => copyToClipboard(item.aiAnalysis!.callsign!)}
                                    className="p-1 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-white"
                                    title="Copy Callsign"
                                  >
                                    📋
                                  </button>
                                  <button 
                                    onClick={() => openQRZ(item.aiAnalysis!.callsign!)}
                                    className="p-1 hover:bg-blue-500/20 rounded transition-colors text-blue-400"
                                    title="Lookup on QRZ.com"
                                  >
                                    🌐
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {item.aiAnalysis.report && (
                            <div className="text-right">
                              <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest block opacity-70">Signal</span>
                              <span className="text-lg font-mono font-bold text-green-400">{item.aiAnalysis.report}</span>
                            </div>
                          )}
                        </div>

                        {(item.aiAnalysis.operatorName || item.aiAnalysis.location) && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                            {item.aiAnalysis.operatorName && (
                              <div className="flex flex-col">
                                <span className="text-[8px] text-gray-500 uppercase font-bold">Operator</span>
                                <span className="text-xs text-gray-300 truncate">{item.aiAnalysis.operatorName}</span>
                              </div>
                            )}
                            {item.aiAnalysis.location && (
                              <div className="flex flex-col">
                                <span className="text-[8px] text-gray-500 uppercase font-bold">Location</span>
                                <span className="text-xs text-gray-300 truncate">📍 {item.aiAnalysis.location}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4 p-4 bg-gray-800/30 rounded-xl border border-gray-800 flex items-center justify-center text-center">
                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">
                          No analysis performed yet.<br/>Use AI Scan to extract radio metadata.
                        </p>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-bold text-gray-400 border border-gray-700 uppercase tracking-tighter">
                        Mode: {item.mode}
                      </div>
                      <span className="text-[9px] text-gray-600 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString()} · {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Footer Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <button 
                        onClick={() => onAnalyze(item)}
                        disabled={!!analyzingId || !!item.aiAnalysis}
                        className={`flex items-center justify-center gap-2 text-[10px] font-bold py-3 rounded-xl transition-all shadow-lg border ${
                          item.aiAnalysis 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20 cursor-default' 
                            : 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white border-blue-400/30 active:scale-95 disabled:opacity-30'
                        }`}
                      >
                        {item.aiAnalysis ? '✓ ANALYSIS COMPLETE' : '✨ AI VISION SCAN'}
                      </button>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onDownload(item)}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all border border-gray-700 flex items-center justify-center text-sm"
                          title="Download Image"
                        >
                          💾
                        </button>
                        <button 
                          onClick={() => onDelete(item.id)}
                          className="flex-1 bg-gray-800 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-xl transition-all border border-gray-700 hover:border-red-500/30 flex items-center justify-center text-sm"
                          title="Delete Record"
                        >
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

        <div className="bg-gray-900 px-8 py-4 border-t border-gray-800 text-[10px] text-gray-600 flex justify-between items-center">
          <div className="flex gap-6">
            <span>DATABASE CAPACITY: 50 RECORDS</span>
            <span>STORAGE UTILIZATION: {Math.round((items.length / 50) * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span className="text-blue-500/70 font-bold tracking-widest uppercase">Adivor Engine v1.5</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
