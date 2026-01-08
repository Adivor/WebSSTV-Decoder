
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SSTVModeId, DecoderStatus, HistoryItem, AIAnalysisResult } from './types';
import { MODES, FREQ_BLACK, FREQ_WHITE, FREQ_SYNC, FREQ_VIS_LEADER } from './constants';
import { AudioEngine } from './services/AudioEngine';
import { SignalIndicator } from './components/SignalIndicator';
import { ModeSelector } from './components/ModeSelector';
import { HistoryModal } from './components/HistoryModal';
import { GoogleGenAI, Type } from "@google/genai";

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SSTVModeId>(SSTVModeId.MARTIN1);
  const [status, setStatus] = useState<DecoderStatus>(DecoderStatus.IDLE);
  const [signal, setSignal] = useState({ freq: 0, level: 0 });
  const [fftData, setFftData] = useState<Uint8Array>(new Uint8Array(0));
  
  // Audio Device States
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  // DSP States
  const [afcEnabled, setAfcEnabled] = useState(true);
  const [afcOffset, setAfcOffset] = useState(0);
  const [lmsEnabled, setLmsEnabled] = useState(false);
  const [bpfEnabled, setBpfEnabled] = useState(false);
  const [bpfWidth, setBpfWidth] = useState<'narrow' | 'medium' | 'wide'>('medium');
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(false);
  
  // Progress states
  const [progress, setProgress] = useState(0);
  const [currentLineDisplay, setCurrentLineDisplay] = useState(0);

  // History states
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const animationFrameRef = useRef<number | null>(null);
  
  // Decoding state
  const currentLineRef = useRef(0);
  const currentPixelRef = useRef(0);
  const isDecodingRef = useRef(false);
  const imageBufferRef = useRef<ImageData | null>(null);

  // Auto-detection robustness refs
  const leaderConfidenceRef = useRef(0);
  const syncConfidenceRef = useRef(0);
  const lastStateResetRef = useRef(Date.now());

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sstv_history');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Fetch audio devices
  useEffect(() => {
    const fetchDevices = async () => {
      const audioDevices = await AudioEngine.getDevices();
      setDevices(audioDevices);
      if (audioDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioDevices[0].deviceId);
      }
    };
    fetchDevices();
  }, [selectedDeviceId]);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sstv_history', JSON.stringify(history));
  }, [history]);

  // Sync DSP state to engine
  useEffect(() => {
    if (isActive) {
      engineRef.current.setBpf(bpfEnabled, bpfWidth);
      engineRef.current.setLms(lmsEnabled);
      engineRef.current.setNoiseReduction(noiseReductionEnabled);
    }
  }, [isActive, bpfEnabled, bpfWidth, lmsEnabled, noiseReductionEnabled]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      dataUrl,
      mode: selectedMode === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedMode
    };

    setHistory(prev => [newItem, ...prev].slice(0, 50)); // Limit to 50 items
  }, [selectedMode]);

  const runAIAnalysis = async (item: HistoryItem) => {
    if (analyzingId) return;
    setAnalyzingId(item.id);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = item.dataUrl.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: "Analyze this amateur radio SSTV image. Extract the callsign, operator name, signal report (RST), and location if visible. Return the results in structured JSON format." },
              { inlineData: { mimeType: "image/png", data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              callsign: { type: Type.STRING, description: "Amateur radio callsign found in the image (e.g. K1ABC, I0XXX)" },
              operatorName: { type: Type.STRING, description: "Name of the person mentioned" },
              location: { type: Type.STRING, description: "City, Country or Grid Square" },
              report: { type: Type.STRING, description: "Signal report (e.g. 599)" },
              otherInfo: { type: Type.STRING, description: "Any other relevant radio text found" },
              rawSummary: { type: Type.STRING, description: "Brief description of the image content" }
            }
          }
        }
      });

      const analysisResult: AIAnalysisResult = JSON.parse(response.text || '{}');
      
      setHistory(prev => prev.map(h => 
        h.id === item.id ? { ...h, aiAnalysis: analysisResult } : h
      ));

    } catch (error) {
      console.error("AI Analysis failed:", error);
      alert("AI Analysis failed. Check console for details.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all decoded images?")) {
      setHistory([]);
    }
  };

  const downloadHistoryItem = (item: HistoryItem) => {
    const link = document.createElement('a');
    link.download = `sstv_${item.mode.replace(/\s+/g, '_')}_${new Date(item.timestamp).toISOString()}.png`;
    link.href = item.dataUrl;
    link.click();
  };

  const startDecoding = useCallback((modeId: SSTVModeId) => {
    const mode = MODES[modeId] || MODES[SSTVModeId.MARTIN1];
    setStatus(DecoderStatus.RECEIVING);
    isDecodingRef.current = true;
    currentLineRef.current = 0;
    currentPixelRef.current = 0;
    setProgress(0);
    setCurrentLineDisplay(0);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = mode.width;
        canvas.height = mode.height;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, mode.width, mode.height);
        imageBufferRef.current = ctx.createImageData(mode.width, mode.height);
      }
    }
  }, []);

  const handleModeSelect = (mode: SSTVModeId) => {
    setSelectedMode(mode);
    if (mode === SSTVModeId.AUTO) {
      setStatus(DecoderStatus.LISTENING);
    }
  };

  const togglePower = async () => {
    if (isActive) {
      engineRef.current.stop();
      setIsActive(false);
      setStatus(DecoderStatus.IDLE);
      setAfcOffset(0);
      setProgress(0);
      setCurrentLineDisplay(0);
      leaderConfidenceRef.current = 0;
      syncConfidenceRef.current = 0;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    } else {
      const success = await engineRef.current.start(selectedDeviceId);
      if (success) {
        setIsActive(true);
        setStatus(selectedMode === SSTVModeId.AUTO ? DecoderStatus.LISTENING : DecoderStatus.LISTENING);
        loop();
      }
    }
  };

  const loop = () => {
    const data = engineRef.current.getFrequency();
    
    // 1. AFC Logic
    if (afcEnabled && Math.abs(data.freq - (FREQ_SYNC + afcOffset)) < 60 && data.level > 0.3) {
      const measuredOffset = data.freq - FREQ_SYNC;
      setAfcOffset(prev => prev * 0.9 + measuredOffset * 0.1);
    }

    setSignal(data);
    setFftData(engineRef.current.getByteFrequencyData());

    // --- REFINED AUTO-DETECTION LOGIC ---
    if (status !== DecoderStatus.RECEIVING) {
      const isLeaderFreq = Math.abs(data.freq - (FREQ_VIS_LEADER + afcOffset)) < 40 && data.level > 0.15;
      const isSyncFreq = Math.abs(data.freq - (FREQ_SYNC + afcOffset)) < 40 && data.level > 0.15;

      // Every 2 seconds of silence/garbage, reset detection state
      if (Date.now() - lastStateResetRef.current > 2000) {
        leaderConfidenceRef.current = 0;
        syncConfidenceRef.current = 0;
        lastStateResetRef.current = Date.now();
      }

      if (isLeaderFreq) {
        leaderConfidenceRef.current++;
        lastStateResetRef.current = Date.now();
      } else if (isSyncFreq && leaderConfidenceRef.current > 10) {
        syncConfidenceRef.current++;
        lastStateResetRef.current = Date.now();
      } else if (!isSyncFreq && !isLeaderFreq && data.level > 0.1) {
        leaderConfidenceRef.current = Math.max(0, leaderConfidenceRef.current - 0.5);
        syncConfidenceRef.current = Math.max(0, syncConfidenceRef.current - 0.5);
      }

      if (leaderConfidenceRef.current >= 15 && syncConfidenceRef.current >= 5) {
        if (!isDecodingRef.current) {
          leaderConfidenceRef.current = 0;
          syncConfidenceRef.current = 0;
          startDecoding(selectedMode === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedMode);
        }
      }
    }

    // 2. If decoding
    if (isDecodingRef.current && imageBufferRef.current) {
      const modeId = selectedMode === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedMode;
      const mode = MODES[modeId];
      
      const correctedFreq = afcEnabled ? data.freq - afcOffset : data.freq;
      let val = ((correctedFreq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255;
      val = Math.max(0, Math.min(255, val));

      const idx = (currentLineRef.current * mode.width + currentPixelRef.current) * 4;
      imageBufferRef.current.data[idx] = val;
      imageBufferRef.current.data[idx + 1] = val;
      imageBufferRef.current.data[idx + 2] = val;
      imageBufferRef.current.data[idx + 3] = 255;

      currentPixelRef.current++;
      if (currentPixelRef.current >= mode.width) {
        currentPixelRef.current = 0;
        currentLineRef.current++;
        setProgress((currentLineRef.current / mode.height) * 100);
        setCurrentLineDisplay(currentLineRef.current);
        
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.putImageData(imageBufferRef.current, 0, 0);
        }

        if (currentLineRef.current >= mode.height) {
          isDecodingRef.current = false;
          setStatus(DecoderStatus.IDLE);
          setProgress(100);
          saveToHistory();
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      engineRef.current.stop();
    };
  }, []);

  const activeModeConfig = MODES[selectedMode === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedMode];

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center bg-[#0a0a0c]">
      <div className="w-full max-w-5xl bg-[#1a202c] border-4 border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center text-[10px] text-gray-400">
          <div className="font-bold text-gray-400 uppercase tracking-tighter">WEB-SSTV DECODER ENGINE by Adivor</div>
          <div className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-4">
            <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">LIVE RX MONITOR</span>
            <span>RX-SSTV v3.2.2</span>
          </div>
        </div>

        <div className="bg-gray-750 px-4 py-2 flex gap-4 border-b border-gray-700 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button 
            onClick={togglePower}
            className={`flex items-center gap-2 px-4 py-1 rounded border transition-all flex-shrink-0 ${
              isActive 
                ? 'bg-red-900/30 border-red-500 text-red-400 hover:bg-red-900/50' 
                : 'bg-green-900/30 border-green-500 text-green-400 hover:bg-green-900/50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
            {isActive ? 'STOP RX' : 'START RX'}
          </button>
          
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-2 py-1 rounded flex-shrink-0">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mr-1">Input:</span>
            <select 
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={isActive}
              className="bg-transparent text-[10px] text-gray-300 outline-none border-none cursor-pointer max-w-[150px] disabled:opacity-50"
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId} className="bg-gray-800 text-gray-300">
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                </option>
              ))}
              {devices.length === 0 && <option value="">No Devices Found</option>}
            </select>
          </div>

          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:border-blue-500/50 transition-all group flex-shrink-0"
          >
            <span className="group-hover:scale-110 transition-transform">📚</span>
            <span>History</span>
            {history.length > 0 && (
              <span className="bg-blue-600 text-white px-1.5 py-0 rounded-full text-[9px] font-bold">
                {history.length}
              </span>
            )}
          </button>
          
          <div className="flex gap-4 ml-auto items-center flex-shrink-0">
            {noiseReductionEnabled && (
              <span className="text-[10px] text-cyan-400 font-bold bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-500/30">NR ON</span>
            )}
            {lmsEnabled && (
              <span className="text-[10px] text-purple-400 font-bold bg-purple-900/20 px-2 py-0.5 rounded border border-purple-500/30">LMS ACTIVE</span>
            )}
            {bpfEnabled && (
              <span className="text-[10px] text-blue-400 font-bold bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/30">BPF: {bpfWidth.toUpperCase()}</span>
            )}
            {afcEnabled && afcOffset !== 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">AFC OFFSET:</span>
                <span className="text-[10px] text-white font-mono bg-black px-2 py-0.5 rounded border border-gray-700">
                  {afcOffset > 0 ? '+' : ''}{afcOffset.toFixed(1)} Hz
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-6 flex-1 bg-[#1a202c]">
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative crt-screen bg-black overflow-hidden flex items-center justify-center aspect-[4/3]">
                <canvas 
                  ref={canvasRef} 
                  className="max-w-full max-h-full object-contain image-pixelated"
                  style={{ imageRendering: 'pixelated' }}
                />
                {!isActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center">
                    <div className="text-blue-400 text-4xl mb-4 opacity-20">(((📡)))</div>
                    <p className="text-gray-500 text-sm max-w-xs px-4">Press Start to begin listening for SSTV signals</p>
                  </div>
                )}
                {isActive && status === DecoderStatus.LISTENING && (
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded border border-green-500/30 shadow-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                      <span className="text-green-500 text-[10px] font-bold tracking-widest uppercase">Sync Search...</span>
                    </div>
                  </div>
                )}
                {status === DecoderStatus.RECEIVING && (
                   <div className="absolute top-4 right-4 bg-black/70 px-3 py-1.5 rounded border border-blue-500/30 text-[10px] font-mono text-blue-400 flex flex-col items-end shadow-xl">
                     <span className="text-blue-200">LINE: {currentLineDisplay} / {activeModeConfig.height}</span>
                     <span className="font-bold">PROGRESS: {Math.round(progress)}%</span>
                   </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end items-center bg-gray-800/50 p-2 rounded border border-gray-700">
               <div className="flex gap-2">
                 <button 
                  onClick={saveToHistory}
                  disabled={progress < 5} 
                  className="px-3 py-1 bg-blue-600 text-[10px] rounded hover:bg-blue-500 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   💾 SAVE FRAME
                 </button>
                 <button 
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      ctx?.clearRect(0, 0, canvas.width, canvas.height);
                      ctx!.fillStyle = '#000';
                      ctx!.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    setProgress(0);
                    setCurrentLineDisplay(0);
                  }}
                  className="px-3 py-1 bg-gray-700 text-[10px] rounded hover:bg-gray-600 text-gray-300 font-bold transition-colors"
                 >
                   🗑 CLEAR
                 </button>
               </div>
            </div>
          </div>

          <div className="w-full md:w-80 flex flex-col gap-4">
            <SignalIndicator frequency={signal.freq} level={signal.level} fftData={fftData} />
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Scanline Progress</span>
                <span className={`text-[10px] font-bold ${status === DecoderStatus.RECEIVING ? 'text-blue-400' : 'text-gray-600'}`}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="flex gap-1 h-3">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div 
                    key={i}
                    className={`flex-1 rounded-sm transition-all duration-300 ${
                      progress > (i / 20) * 100 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <ModeSelector 
              selectedMode={selectedMode} 
              onSelect={handleModeSelect} 
              status={status}
              afcEnabled={afcEnabled}
              onToggleAfc={() => setAfcEnabled(!afcEnabled)}
              lmsEnabled={lmsEnabled}
              onToggleLms={() => setLmsEnabled(!lmsEnabled)}
              bpfEnabled={bpfEnabled}
              onToggleBpf={() => setBpfEnabled(!bpfEnabled)}
              bpfWidth={bpfWidth}
              onChangeBpfWidth={setBpfWidth}
              noiseReductionEnabled={noiseReductionEnabled}
              onToggleNoiseReduction={() => setNoiseReductionEnabled(!noiseReductionEnabled)}
            />
          </div>
        </div>

        <div className="bg-blue-600 px-4 py-1 flex justify-between items-center text-[10px] text-white font-bold">
           <div className="flex gap-4">
             <span>STATUS: {isActive ? 'ACTIVE' : 'READY'}</span>
             <span>MODE: {selectedMode}</span>
           </div>
           <div className="flex items-center gap-4">
              <span className="uppercase tracking-widest">{status}</span>
           </div>
        </div>
      </div>

      <HistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={history}
        onDelete={deleteFromHistory}
        onDownload={downloadHistoryItem}
        onClear={clearHistory}
        onAnalyze={runAIAnalysis}
        analyzingId={analyzingId}
      />
    </div>
  );
};

export default App;
