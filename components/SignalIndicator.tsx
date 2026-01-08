
import React, { useEffect, useRef } from 'react';

interface SignalIndicatorProps {
  frequency: number;
  level: number;
  fftData: Uint8Array;
}

export const SignalIndicator: React.FC<SignalIndicatorProps> = ({ frequency, level, fftData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple waterfall/spectrum view
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear and redraw
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Grid lines for standard SSTV frequencies
    const drawGrid = (f: number, label: string, color: string) => {
      const x = (f / 3000) * width;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.fillText(label, x + 2, 12);
    };

    drawGrid(1200, '1200', 'rgba(255,0,0,0.5)');
    drawGrid(1500, '1500', 'rgba(255,255,255,0.3)');
    drawGrid(1900, '1900', 'rgba(0,255,255,0.3)');
    drawGrid(2300, '2300', 'rgba(255,255,255,0.3)');

    // FFT Visualization
    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    for (let i = 0; i < fftData.length; i++) {
      const x = (i / fftData.length) * (width * (15000 / 3000)); // Zoom into relevant range
      const y = height - (fftData[i] / 255) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Frequency marker
    const markerX = (frequency / 3000) * width;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(markerX - 1, 0, 3, height);

  }, [fftData, frequency]);

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400">SIGNAL</span>
        <span className="text-sm font-bold text-green-400">{Math.round(frequency)} Hz</span>
      </div>
      <div className="h-4 bg-gray-800 rounded overflow-hidden relative border border-gray-700">
        <div 
          className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-75"
          style={{ width: `${Math.min(100, level * 100)}%` }}
        />
      </div>
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={80} 
        className="w-full bg-black rounded border border-gray-700"
      />
    </div>
  );
};
