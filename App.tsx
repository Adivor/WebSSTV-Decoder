
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
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [afcEnabled, setAfcEnabled] = useState(true);
  const [afcOffset, setAfcOffset] = useState(0);
  const [lmsEnabled, setLmsEnabled] = useState(false);
  const [bpfEnabled, setBpfEnabled] = useState(false);
  const [bpfWidth, setBpfWidth] = useState<'narrow' | 'medium' | 'wide'>('medium');
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [currentLineDisplay, setCurrentLineDisplay] = useState(0);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const animationFrameRef = useRef<number | null>(null);

  // REFS PER LOOP DI DECODIFICA (Evita stale closures)
  const statusRef = useRef<DecoderStatus>(DecoderStatus.IDLE);
  const selectedModeRef = useRef<SSTVModeId>(SSTVModeId.MARTIN1);
  const afcEnabledRef = useRef(true);
  const afcOffsetRef = useRef(0);
  const isDecodingRef = useRef(false);
  const currentLineRef = useRef(0);
  const currentPixelRef = useRef(0);
  const imageBufferRef = useRef<ImageData | null>(null);
  const leaderConfidenceRef = useRef(0);
  const syncConfidenceRef = useRef(0);
  const lastStateResetRef = useRef(Date.now());

  useEffect(() => {
    statusRef.current = status;
    selectedModeRef.current = selectedMode;
    afcEnabledRef.current = afcEnabled;
    afcOffsetRef.current = afcOffset;
  }, [status, selectedMode, afcEnabled, afcOffset]);

  useEffect(() => {
    const stored = localStorage.getItem('sstv_history');
    if (stored) {
      try { setHistory(JSON.parse(stored)); } catch (e) { console.error(e); }
    }
    const fetchDevices = async () => {
      const audioDevices = await AudioEngine.getDevices();
      setDevices(audioDevices);
      if (audioDevices.length > 0 && !selectedDeviceId) setSelectedDeviceId(audioDevices[0].deviceId);
    };
    fetchDevices();
  }, []);

  useEffect(() => {
    localStorage.setItem('sstv_history', JSON.stringify(history));
  }, [history]);

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
      mode: selectedModeRef.current === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedModeRef.current
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50));
  }, []);

  const runAIAnalysis = async (item: HistoryItem) => {
    if (analyzingId) return;
    setAnalyzingId(item.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = item.dataUrl.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { text: "Analyze this amateur radio SSTV image. Identify and extract: callsign, operator name, signal report (RST), location, operational frequency, SSTV mode used, and any other visible technical details or equipment mentioned. Return findings in JSON." },
            { inlineData: { mimeType: "image/png", data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              callsign: { type: Type.STRING },
              operatorName: { type: Type.STRING },
              location: { type: Type.STRING },
              report: { type: Type.STRING },
              frequency: { type: Type.STRING },
              mode: { type: Type.STRING },
              technicalDetails: { type: Type.STRING },
              otherInfo: { type: Type.STRING },
              rawSummary: { type: Type.STRING }
            }
          }
        }
      });
      const result: AIAnalysisResult = JSON.parse(response.text || '{}');
      setHistory(prev => prev.map(h => h.id === item.id ? { ...h, aiAnalysis: result } : h));
    } catch (error) {
      console.error(error);
    } finally {
      setAnalyzingId(null);
    }
  };

  const startDecoding = useCallback((modeId: SSTVModeId) => {
    const mId = modeId === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : modeId;
    const mode = MODES[mId] || MODES[SSTVModeId.MARTIN1];
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

  const togglePower = async () => {
    if (isActive) {
      engineRef.current.stop();
      setIsActive(false);
      setStatus(DecoderStatus.IDLE);
      setAfcOffset(0);
      afcOffsetRef.current = 0;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else {
      const success = await engineRef.current.start(selectedDeviceId);
      if (success) {
        setIsActive(true);
        setStatus(DecoderStatus.LISTENING);
        loop();
      }
    }
  };

  const loop = () => {
    const data = engineRef.current.getFrequency();
    setSignal(data);
    setFftData(engineRef.current.getByteFrequencyData());

    if (afcEnabledRef.current && Math.abs(data.freq - (FREQ_SYNC + afcOffsetRef.current)) < 60 && data.level > 0.3) {
      const measuredOffset = data.freq - FREQ_SYNC;
      const newOffset = afcOffsetRef.current * 0.9 + measuredOffset * 0.1;
      afcOffsetRef.current = newOffset;
      setAfcOffset(newOffset);
    }

    if (statusRef.current !== DecoderStatus.RECEIVING) {
      const isLeader = Math.abs(data.freq - (FREQ_VIS_LEADER + afcOffsetRef.current)) < 50 && data.level > 0.15;
      const isSync = Math.abs(data.freq - (FREQ_SYNC + afcOffsetRef.current)) < 50 && data.level > 0.15;

      if (Date.now() - lastStateResetRef.current > 2000) {
        leaderConfidenceRef.current = 0;
        syncConfidenceRef.current = 0;
        lastStateResetRef.current = Date.now();
      }

      if (isLeader) {
        leaderConfidenceRef.current++;
        lastStateResetRef.current = Date.now();
      } else if (isSync && leaderConfidenceRef.current > 5) {
        syncConfidenceRef.current++;
        lastStateResetRef.current = Date.now();
      }

      if (leaderConfidenceRef.current >= 10 && syncConfidenceRef.current >= 3) {
        leaderConfidenceRef.current = 0;
        syncConfidenceRef.current = 0;
        startDecoding(selectedModeRef.current);
      }
    }

    if (isDecodingRef.current && imageBufferRef.current) {
      const mId = selectedModeRef.current === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedModeRef.current;
      const mode = MODES[mId];
      const correctedFreq = afcEnabledRef.current ? data.freq - afcOffsetRef.current : data.freq;
      let val = ((correctedFreq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)) * 255;
      val = Math.max(0, Math.min(255, val));

      const idx = (currentLineRef.current * mode.width + currentPixelRef.current) * 4;
      imageBufferRef.current.data[idx] = val;
      imageBufferRef.current.data[idx+1] = val;
      imageBufferRef.current.data[idx+2] = val;
      imageBufferRef.current.data[idx+3] = 255;

      currentPixelRef.current++;
      if (currentPixelRef.current >= mode.width) {
        currentPixelRef.current = 0;
        currentLineRef.current++;
        const p = (currentLineRef.current / mode.height) * 100;
        setProgress(p);
        setCurrentLineDisplay(currentLineRef.current);
        if (canvasRef.current) canvasRef.current.getContext('2d')?.putImageData(imageBufferRef.current, 0, 0);
        if (currentLineRef.current >= mode.height) {
          isDecodingRef.current = false;
          setStatus(DecoderStatus.IDLE);
          saveToHistory();
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const activeModeConfig = MODES[selectedMode === SSTVModeId.AUTO ? SSTVModeId.MARTIN1 : selectedMode];

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center bg-[#0a0a0c]">
      <div className="w-full max-w-5xl bg-[#1a202c] border-4 border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center text-[10px] text-gray-400">
          <div className="font-bold uppercase tracking-tighter">WEB-SSTV ENGINE by Adivor</div>
          <div className="font-bold flex items-center gap-4">
            <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">RX MONITOR</span>
            <span>v3.5.0</span>
          </div>
        </div>

        <div className="bg-gray-750 px-4 py-2 flex gap-4 border-b border-gray-700 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button onClick={togglePower} className={`px-4 py-1 rounded border transition-all ${isActive ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-green-900/30 border-green-500 text-green-400'}`}>
            {isActive ? 'STOP RX' : 'START RX'}
          </button>
          <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} disabled={isActive} className="bg-gray-800 text-[10px] text-gray-300 rounded px-2 outline-none">
            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Mic'}</option>)}
          </select>
          <button onClick={() => setIsHistoryOpen(true)} className="bg-gray-800 border border-gray-700 px-3 py-1 rounded text-xs text-gray-400 hover:text-white">
            📚 History ({history.length})
          </button>
          <div className="ml-auto flex items-center gap-4">
            {afcOffset !== 0 && <span className="text-[10px] text-white font-mono bg-black px-2 rounded border border-gray-700">AFC: {afcOffset > 0 ? '+' : ''}{afcOffset.toFixed(1)}Hz</span>}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-6 flex-1 bg-[#1a202c]">
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-10"></div>
              <div className="relative crt-screen bg-black overflow-hidden aspect-[4/3] flex items-center justify-center">
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain image-pixelated" />
                {!isActive && <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-gray-500 text-sm">PRESS START TO RECEIVE</div>}
                {status === DecoderStatus.RECEIVING && (
                  <div className="absolute top-4 right-4 bg-black/70 px-2 py-1 rounded border border-blue-500/30 text-[10px] text-blue-400 font-mono">
                    LINE: {currentLineDisplay}/{activeModeConfig.height} ({Math.round(progress)}%)
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={saveToHistory} disabled={progress < 5} className="px-3 py-1 bg-blue-600 text-[10px] rounded hover:bg-blue-500 text-white font-bold disabled:opacity-50">SAVE</button>
              <button onClick={() => { if(canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx?.fillRect(0,0,canvasRef.current.width,canvasRef.current.height); } setProgress(0); }} className="px-3 py-1 bg-gray-700 text-[10px] rounded text-gray-300 font-bold">CLEAR</button>
            </div>
          </div>

          <div className="w-full md:w-80 flex flex-col gap-4">
            <SignalIndicator frequency={signal.freq} level={signal.level} fftData={fftData} />
            <ModeSelector 
              selectedMode={selectedMode} onSelect={setSelectedMode} status={status}
              afcEnabled={afcEnabled} onToggleAfc={() => setAfcEnabled(!afcEnabled)}
              lmsEnabled={lmsEnabled} onToggleLms={() => setLmsEnabled(!lmsEnabled)}
              bpfEnabled={bpfEnabled} onToggleBpf={() => setBpfEnabled(!bpfEnabled)}
              bpfWidth={bpfWidth} onChangeBpfWidth={setBpfWidth}
              noiseReductionEnabled={noiseReductionEnabled} onToggleNoiseReduction={() => setNoiseReductionEnabled(!noiseReductionEnabled)}
            />
          </div>
        </div>
      </div>

      <HistoryModal 
        isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} items={history}
        onDelete={id => setHistory(prev => prev.filter(i => i.id !== id))}
        onDownload={item => { const l = document.createElement('a'); l.download='sstv.png'; l.href=item.dataUrl; l.click(); }}
        onClear={() => { if(confirm('Clear history?')) setHistory([]); }}
        onAnalyze={runAIAnalysis} analyzingId={analyzingId}
      />
    </div>
  );
};

export default App;
