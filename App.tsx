
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
  const [autoStart, setAutoStart] = useState(() => localStorage.getItem('sstv_autostart') === 'true');
  const [autoSave, setAutoSave] = useState(() => (localStorage.getItem('sstv_autosave') || 'true') === 'true');
  const [selectedMode, setSelectedMode] = useState<SSTVModeId>(SSTVModeId.MARTIN1);
  const [status, setStatus] = useState<DecoderStatus>(DecoderStatus.IDLE);
  const [signal, setSignal] = useState({ freq: 0, level: 0 });
  const [fftData, setFftData] = useState<Uint8Array>(new Uint8Array(0));
  const [inputGain, setInputGain] = useState(50);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => localStorage.getItem('sstv_device_id') || '');
  
  const [afcEnabled, setAfcEnabled] = useState(true);
  const [afcOffset, setAfcOffset] = useState(0);
  const [lmsEnabled, setLmsEnabled] = useState(false);
  const [bpfEnabled, setBpfEnabled] = useState(false);
  const [bpfFrequency, setBpfFrequency] = useState(1750);
  const [bpfQ, setBpfQ] = useState(1.5);
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [currentLineDisplay, setCurrentLineDisplay] = useState(0);
  const [showSaveFlash, setShowSaveFlash] = useState(false);
  const [isCleaningCurrent, setIsCleaningCurrent] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const animationFrameRef = useRef<number | null>(null);
  
  const isActiveRef = useRef(false);
  const statusRef = useRef<DecoderStatus>(DecoderStatus.IDLE);
  const selectedModeRef = useRef<SSTVModeId>(SSTVModeId.MARTIN1);
  const isDecodingRef = useRef(false);
  const imageBufferRef = useRef<ImageData | null>(null);
  const autoSaveRef = useRef(autoSave);
  const pendingSaveRef = useRef(false);
  
  const lastLineStartTimeRef = useRef(0);
  const currentLineRef = useRef(0);
  const leaderConfidenceRef = useRef(0);
  const syncConfidenceRef = useRef(0);
  const syncDetectedInLineRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
    statusRef.current = status;
    selectedModeRef.current = selectedMode;
    autoSaveRef.current = autoSave;
  }, [isActive, status, selectedMode, autoSave]);

  useEffect(() => {
    engineRef.current.setGain(inputGain);
  }, [inputGain]);

  useEffect(() => {
    engineRef.current.setBpf(bpfEnabled, bpfFrequency, bpfQ);
  }, [bpfEnabled, bpfFrequency, bpfQ]);

  useEffect(() => {
    engineRef.current.setLms(lmsEnabled);
  }, [lmsEnabled]);

  useEffect(() => {
    engineRef.current.setNoiseReduction(noiseReductionEnabled);
  }, [noiseReductionEnabled]);

  useEffect(() => {
    localStorage.setItem('sstv_autostart', String(autoStart));
  }, [autoStart]);

  useEffect(() => {
    localStorage.setItem('sstv_autosave', String(autoSave));
  }, [autoSave]);

  useEffect(() => {
    if (selectedDeviceId) localStorage.setItem('sstv_device_id', selectedDeviceId);
  }, [selectedDeviceId]);

  useEffect(() => {
    const stored = localStorage.getItem('sstv_history');
    if (stored) try { setHistory(JSON.parse(stored)); } catch (e) { console.error(e); }
    
    const init = async () => {
      const audioDevices = await AudioEngine.getDevices();
      setDevices(audioDevices);
      const dev = selectedDeviceId || (audioDevices.length > 0 ? audioDevices[0].deviceId : '');
      if (dev) setSelectedDeviceId(dev);

      if (autoStart && dev) {
        startEngine(dev);
      }
    };
    init();
    return () => engineRef.current.stop();
  }, []);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Trigger flash effect
    setShowSaveFlash(true);
    setTimeout(() => setShowSaveFlash(false), 300);

    const dataUrl = canvas.toDataURL('image/png');
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      dataUrl,
      mode: selectedModeRef.current === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedModeRef.current
    };
    
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 50);
      localStorage.setItem('sstv_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const startDecoding = useCallback((modeId: SSTVModeId) => {
    const targetMode = modeId === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : modeId;
    const mode = MODES[targetMode] || MODES[SSTVModeId.MARTIN1];
    setStatus(DecoderStatus.RECEIVING);
    isDecodingRef.current = true;
    currentLineRef.current = 0;
    lastLineStartTimeRef.current = performance.now();
    syncDetectedInLineRef.current = true;
    setProgress(0);
    setCurrentLineDisplay(0);
    pendingSaveRef.current = false;
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = mode.width;
      canvas.height = mode.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, mode.width, mode.height);
        imageBufferRef.current = ctx.createImageData(mode.width, mode.height);
      }
    }
  }, []);

  const stopDecoding = useCallback(() => {
    isDecodingRef.current = false;
    setStatus(DecoderStatus.IDLE);
    pendingSaveRef.current = false;
  }, []);

  const processAudioFrequency = (data: { freq: number; level: number }) => {
    if (!isActiveRef.current) return;

    setSignal(data);

    const isSync = Math.abs(data.freq - (FREQ_SYNC + afcOffset)) < 60 && data.level > 0.15;

    if (statusRef.current === DecoderStatus.LISTENING) {
      const isLeader = Math.abs(data.freq - (FREQ_VIS_LEADER + afcOffset)) < 60 && data.level > 0.2;
      if (isLeader) leaderConfidenceRef.current++;
      else if (isSync && leaderConfidenceRef.current > 5) syncConfidenceRef.current++;
      
      if (leaderConfidenceRef.current > 10 && syncConfidenceRef.current > 4) {
        leaderConfidenceRef.current = 0;
        syncConfidenceRef.current = 0;
        startDecoding(selectedModeRef.current);
      }
    }

    if (isDecodingRef.current && imageBufferRef.current) {
      const mId = selectedModeRef.current === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedModeRef.current;
      const mode = MODES[mId];
      const now = performance.now();
      
      if (isSync && !syncDetectedInLineRef.current) {
        lastLineStartTimeRef.current = now;
        syncDetectedInLineRef.current = true;
      }

      if (syncDetectedInLineRef.current) {
        const timeInLine = now - lastLineStartTimeRef.current - mode.syncTime;
        
        if (timeInLine >= 0) {
          const totalLineTime = (mode.channelTime + mode.gapTime) * mode.numChannels;
          
          if (timeInLine > totalLineTime) {
            currentLineRef.current++;
            syncDetectedInLineRef.current = false;
            
            if (currentLineRef.current >= mode.height) {
              isDecodingRef.current = false;
              // Segnaliamo al loop di rendering che dobbiamo salvare l'immagine
              pendingSaveRef.current = true;
            }
          } else {
            const channelIndex = Math.floor(timeInLine / (mode.channelTime + mode.gapTime));
            const timeInChannel = timeInLine % (mode.channelTime + mode.gapTime);
            
            if (timeInChannel <= mode.channelTime && channelIndex < mode.numChannels) {
              const x = Math.floor((timeInChannel / mode.channelTime) * mode.width);
              if (x >= 0 && x < mode.width) {
                const color = mode.colorOrder[channelIndex];
                const val = Math.max(0, Math.min(255, ((data.freq - afcOffset - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255));
                
                const pixelIdx = (currentLineRef.current * mode.width + x) * 4;
                if (pixelIdx >= 0 && pixelIdx < imageBufferRef.current.data.length) {
                  if (color === 'R') imageBufferRef.current.data[pixelIdx] = val;
                  else if (color === 'G') imageBufferRef.current.data[pixelIdx + 1] = val;
                  else if (color === 'B') imageBufferRef.current.data[pixelIdx + 2] = val;
                  imageBufferRef.current.data[pixelIdx + 3] = 255;
                }
              }
            }
          }
        }
      }
    }
  };

  const loop = () => {
    if (!isActiveRef.current) return;
    setFftData(engineRef.current.getByteFrequencyData());

    if (imageBufferRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageBufferRef.current, 0, 0);
      }

      if (isDecodingRef.current) {
        const mId = selectedModeRef.current === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedModeRef.current;
        const mode = MODES[mId];
        setProgress((currentLineRef.current / mode.height) * 100);
        setCurrentLineDisplay(currentLineRef.current);
      }

      // Se abbiamo finito di ricevere e dobbiamo salvare
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        setStatus(DecoderStatus.IDLE);
        if (autoSaveRef.current) {
          saveToHistory();
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const startEngine = async (deviceId: string) => {
    const ok = await engineRef.current.start(deviceId, processAudioFrequency);
    if (ok) {
      setIsActive(true);
      isActiveRef.current = true;
      setStatus(DecoderStatus.LISTENING);
      animationFrameRef.current = requestAnimationFrame(loop);
    }
  };

  const togglePower = async () => {
    if (isActive) {
      engineRef.current.stop();
      setIsActive(false);
      isActiveRef.current = false;
      setStatus(DecoderStatus.IDLE);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else {
      startEngine(selectedDeviceId);
    }
  };

  const runAICleanCurrent = async () => {
    if (!canvasRef.current || isCleaningCurrent) return;
    setIsCleaningCurrent(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64Data } },
            { text: "This is a noisy SSTV (Slow Scan Television) image. Please perform a deep restoration: remove all horizontal scanline interference, salt-and-pepper noise, and chromatic aberrations. Reconstruct any missing or fuzzy text like callsigns or signal reports to be sharp and legible. Return only the restored image." },
          ],
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const img = new Image();
          img.onload = () => {
            if (canvasRef.current && imageBufferRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                imageBufferRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            }
          };
          img.src = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    } catch (error) {
      console.error('AI Enhance failed:', error);
    } finally {
      setIsCleaningCurrent(false);
    }
  };

  const runAIClean = async (item: HistoryItem) => {
    if (!item.dataUrl) return;
    setCleaningId(item.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = item.dataUrl.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64Data } },
            { text: "This is a noisy SSTV (Slow Scan Television) image from amateur radio. Please restore it: remove horizontal noise lines, static, and interference streaks. Enhance color clarity and text sharpness (callsigns, names) while keeping the original image content. Output the cleaned image." },
          ],
        }
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const cleanedUrl = `data:image/png;base64,${part.inlineData.data}`;
          setHistory(prev => {
            const updated = prev.map(h => h.id === item.id ? { ...h, cleanedDataUrl: cleanedUrl } : h);
            localStorage.setItem('sstv_history', JSON.stringify(updated));
            return updated;
          });
          break;
        }
      }
    } catch (error) {
      console.error('AI Cleaning failed:', error);
    } finally {
      setCleaningId(null);
    }
  };

  const runAIAnalysis = async (item: HistoryItem) => {
    if (!item.dataUrl) return;
    setAnalyzingId(item.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imageToAnalyze = item.cleanedDataUrl || item.dataUrl;
      const base64Data = imageToAnalyze.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64Data } },
            { text: "Analyze this SSTV amateur radio image. Extract: 1. Callsign, 2. Operator Name, 3. SSTV Mode, 4. Frequency, 5. RST Report, 6. Location/Grid. Return JSON." },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              callsign: { type: Type.STRING },
              operatorName: { type: Type.STRING },
              location: { type: Type.STRING },
              gridLocator: { type: Type.STRING },
              report: { type: Type.STRING },
              frequency: { type: Type.STRING },
              mode: { type: Type.STRING },
              technicalDetails: { type: Type.STRING },
              otherInfo: { type: Type.STRING },
              rawSummary: { type: Type.STRING },
            },
          },
        },
      });
      const analysis: AIAnalysisResult = JSON.parse(response.text || '{}');
      setHistory(prev => {
        const updated = prev.map(h => h.id === item.id ? { ...h, aiAnalysis: analysis } : h);
        localStorage.setItem('sstv_history', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('AI Analysis failed:', error);
    } finally {
      setAnalyzingId(null);
    }
  };

  const currentModeData = MODES[selectedMode === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedMode];

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center bg-[#0a0a0c]">
      <div className={`w-full max-w-5xl bg-[#1a202c] border-4 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ${showSaveFlash ? 'border-blue-400 scale-[1.002]' : 'border-gray-700 hover:border-gray-600'}`}>
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center text-[10px] text-gray-400 font-bold">
          <div className="uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            WebSSTV Decoder v4.0 PRO
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors">
              <input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} className="rounded bg-gray-900 border-gray-700 text-blue-500" />
              AUTO-SAVE
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors">
              <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} className="rounded bg-gray-900 border-gray-700 text-blue-500" />
              AUTO-MONITOR
            </label>
          </div>
        </div>

        <div className="bg-gray-750 px-4 py-3 flex gap-4 border-b border-gray-700 overflow-x-auto">
          <button 
            onClick={togglePower}
            className={`px-6 py-1.5 rounded-lg border-2 font-black transition-all transform active:scale-95 ${
              isActive ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-green-900/40 border-green-500 text-green-400'
            }`}
          >
            {isActive ? '■ DISCONNECT' : '▶ CONNECT RX'}
          </button>
          
          <select 
            value={selectedDeviceId}
            onChange={e => setSelectedDeviceId(e.target.value)}
            disabled={isActive}
            className="bg-gray-800 border border-gray-700 text-[10px] text-gray-300 rounded-lg px-3 outline-none disabled:opacity-50"
          >
            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Audio Input'}</option>)}
          </select>

          <button onClick={() => setIsHistoryOpen(true)} className="bg-gray-800 border border-gray-700 px-4 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-all flex items-center gap-2">
            📦 LOGBOOK <span className="bg-blue-600 text-white px-1.5 rounded-full text-[9px]">{history.length}</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-6 flex-1 bg-[#1a202c]">
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div className="relative crt-screen bg-[#050505] overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
                <div className="scanline"></div>
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full object-contain image-pixelated transition-all duration-300"
                  style={{ imageRendering: 'pixelated' }}
                />
                
                {isCleaningCurrent && (
                  <div className="absolute inset-0 bg-cyan-900/40 backdrop-blur-sm z-40 flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="w-full h-1 bg-cyan-500 absolute top-0 animate-[scan_1s_infinite] shadow-[0_0_20px_cyan]"></div>
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] bg-black/80 px-4 py-2 rounded-lg border border-cyan-500/50">AI RESTORATION IN PROGRESS</span>
                  </div>
                )}

                {showSaveFlash && (
                  <div className="absolute inset-0 bg-blue-500/10 pointer-events-none animate-pulse z-30 flex items-center justify-center">
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-full font-black text-xs shadow-2xl border border-blue-400">IMAGE SAVED TO LOG</div>
                  </div>
                )}

                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="bg-black/60 backdrop-blur-md border border-gray-700 p-2 rounded text-[10px] font-mono text-cyan-400 uppercase">
                      <div className="opacity-50 text-[8px]">Current Mode</div>
                      <div className="font-bold text-sm">{selectedMode}</div>
                    </div>
                    {status === DecoderStatus.RECEIVING && (
                      <div className="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-black animate-pulse flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white"></span> RECEIVING
                      </div>
                    )}
                    {status === DecoderStatus.LISTENING && (
                      <div className="bg-blue-600/20 border border-blue-500/50 text-blue-400 px-2 py-1 rounded text-[10px] font-bold animate-pulse">
                        AUTO-SCANNING...
                      </div>
                    )}
                  </div>
                  {!isActive && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4 z-20">
                      <p className="text-gray-500 text-sm font-bold uppercase tracking-widest animate-pulse">System Offline</p>
                      <button onClick={togglePower} className="mt-4 px-4 py-2 bg-blue-600/20 border border-blue-500 text-blue-400 text-[10px] rounded hover:bg-blue-600/40 transition-all pointer-events-auto">INITIALIZE LINK</button>
                    </div>
                  )}
                  <div className="flex justify-between items-end z-20">
                    <div className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded border border-gray-800/50">
                      SCAN: {currentLineDisplay}/{currentModeData.height}
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded border border-gray-800/50">
                      SYNC: <span className={syncDetectedInLineRef.current ? 'text-green-500' : 'text-gray-500'}>{syncDetectedInLineRef.current ? 'LOCKED' : 'WAITING'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-tighter">
                  <span>Image Reconstruction</span>
                  <span className="text-blue-400">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-700 to-cyan-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {status === DecoderStatus.RECEIVING ? (
                  <button 
                    onClick={stopDecoding}
                    className="px-4 py-1.5 bg-red-600 text-white rounded-lg font-bold text-[10px] hover:bg-red-500 transition-all shadow-lg shadow-red-900/20"
                  >
                    STOP RX
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      if(status === DecoderStatus.IDLE) setStatus(DecoderStatus.LISTENING);
                      startDecoding(selectedMode);
                    }}
                    disabled={!isActive}
                    className="px-4 py-1.5 bg-amber-600 text-white rounded-lg font-bold text-[10px] hover:bg-amber-500 disabled:opacity-30 transition-all shadow-lg shadow-amber-900/20"
                  >
                    MANUAL RX
                  </button>
                )}
                
                <button 
                  onClick={runAICleanCurrent} 
                  disabled={!isActive || progress < 5 || isCleaningCurrent} 
                  className="px-4 py-1.5 bg-cyan-700 text-white rounded-lg font-bold text-[10px] hover:bg-cyan-600 disabled:opacity-30 transition-all shadow-lg shadow-cyan-900/40 border border-cyan-500 flex items-center gap-2"
                >
                  {isCleaningCurrent ? 'CLEANING...' : '✨ AI CLEAN'}
                </button>

                <button 
                  onClick={saveToHistory} 
                  disabled={progress < 2} 
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-[10px] hover:bg-blue-500 disabled:opacity-30 transition-all shadow-lg shadow-blue-900/20"
                >
                  CAPTURE
                </button>
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 flex flex-col gap-6">
            <SignalIndicator 
              frequency={signal.freq} 
              level={signal.level} 
              fftData={fftData} 
              gain={inputGain}
              onGainChange={setInputGain}
            />
            <ModeSelector 
              selectedMode={selectedMode} onSelect={setSelectedMode} status={status}
              afcEnabled={afcEnabled} onToggleAfc={() => setAfcEnabled(!afcEnabled)}
              lmsEnabled={lmsEnabled} onToggleLms={() => setLmsEnabled(!lmsEnabled)}
              bpfEnabled={bpfEnabled} onToggleBpf={() => setBpfEnabled(!bpfEnabled)}
              bpfFrequency={bpfFrequency} onBpfFrequencyChange={setBpfFrequency}
              bpfQ={bpfQ} onBpfQChange={setBpfQ}
              noiseReductionEnabled={noiseReductionEnabled} onToggleNoiseReduction={() => setNoiseReductionEnabled(!noiseReductionEnabled)}
            />
          </div>
        </div>
      </div>

      <HistoryModal 
        isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} items={history}
        onDelete={id => setHistory(prev => {
          const updated = prev.filter(i => i.id !== id);
          localStorage.setItem('sstv_history', JSON.stringify(updated));
          return updated;
        })}
        onDownload={item => { 
          const l = document.createElement('a'); 
          l.download = `sstv_${item.id}.png`; 
          l.href = item.cleanedDataUrl || item.dataUrl; 
          l.click(); 
        }}
        onClear={() => { 
          if(confirm('Purge Logbook?')) {
            setHistory([]);
            localStorage.removeItem('sstv_history');
          }
        }}
        onAnalyze={runAIAnalysis} 
        onClean={runAIClean}
        analyzingId={analyzingId}
        cleaningId={cleaningId}
      />
      <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
    </div>
  );
};

export default App;
