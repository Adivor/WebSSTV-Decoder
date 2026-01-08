
import React, { useEffect, useRef } from 'react';

interface SignalIndicatorProps {
  frequency: number;
  level: number;
  fftData: Uint8Array;
  gain: number;
  onGainChange: (value: number) => void;
}

export const SignalIndicator: React.FC<SignalIndicatorProps> = ({ frequency, level, fftData, gain, onGainChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    const drawGrid = (f: number, label: string, color: string) => {
      const x = (f / 3000) * width;
      ctx.strokeStyle = color;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = '8px monospace';
      ctx.fillText(label, x + 2, 8);
    };

    drawGrid(1200, 'SYNC', 'rgba(255, 50, 50, 0.4)');
    drawGrid(1500, 'BLK', 'rgba(255, 255, 255, 0.2)');
    drawGrid(1900, 'LEAD', 'rgba(0, 255, 255, 0.2)');
    drawGrid(2300, 'WHT', 'rgba(255, 255, 255, 0.2)');

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#064e3b');
    gradient.addColorStop(0.5, '#059669');
    gradient.addColorStop(1, '#10b981');

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < fftData.length; i++) {
      const x = (i / fftData.length) * (width * (15000 / 3000));
      const y = height - (fftData[i] / 255) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const markerX = (frequency / 3000) * width;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fbbf24';
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(markerX - 1, 0, 2, height);
    ctx.shadowBlur = 0;

  }, [fftData, frequency]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-900 rounded-xl border border-gray-800 shadow-lg">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Spectral Density</span>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-mono text-gray-300">{Math.round(frequency)} Hz</span>
           <div className={`w-1.5 h-1.5 rounded-full ${level > 0.1 ? 'bg-green-500 animate-ping' : 'bg-gray-700'}`}></div>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
          <span>Manual Input Gain</span>
          <span className="text-blue-400">{gain}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={gain} 
          onChange={(e) => onGainChange(parseInt(e.target.value))}
          className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <div className="h-4 bg-gray-950 rounded-full overflow-hidden border border-gray-800 relative">
        <div 
          className="h-full bg-gradient-to-r from-blue-900 via-blue-600 to-cyan-400 transition-all duration-300"
          style={{ width: `${Math.min(100, level * 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[8px] font-bold text-gray-500 opacity-50">INPUT LEVEL</span>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={300} 
        height={100} 
        className="w-full h-24 bg-black rounded-lg border border-gray-800 shadow-inner"
      />
    </div>
  );
};
