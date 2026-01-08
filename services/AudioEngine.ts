
export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private gainNode: GainNode | null = null;
  
  // DSP Nodes
  private bpfFilter: BiquadFilterNode | null = null;
  private lpfFilter: BiquadFilterNode | null = null;
  private lmsNode: DynamicsCompressorNode | null = null;
  
  // States
  private bpfEnabled = false;
  private lmsEnabled = false;
  private noiseReductionEnabled = false;
  private currentGainPercent = 50;
  private onFrequencyCallback: ((data: { freq: number; level: number }) => void) | null = null;

  static async getDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      stream.getTracks().forEach(t => t.stop());
      return devices.filter(device => device.kind === 'audioinput');
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return [];
    }
  }

  async start(deviceId?: string, onFreq?: (data: { freq: number; level: number }) => void): Promise<boolean> {
    try {
      this.onFrequencyCallback = onFreq || null;
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048; // Dimensione ridotta per maggiore reattività temporale
      this.analyser.smoothingTimeConstant = 0;
      
      this.processor = this.audioCtx.createScriptProcessor(1024, 1, 1);
      this.processor.onaudioprocess = () => {
        if (this.onFrequencyCallback) {
          this.onFrequencyCallback(this.getFrequency());
        }
      };

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.gainNode = this.audioCtx.createGain();
      this.setGain(this.currentGainPercent);
      
      this.bpfFilter = this.audioCtx.createBiquadFilter();
      this.bpfFilter.type = 'bandpass';
      this.bpfFilter.frequency.value = 1750; 
      this.bpfFilter.Q.value = 1.5;

      this.lpfFilter = this.audioCtx.createBiquadFilter();
      this.lpfFilter.type = 'lowpass';
      this.lpfFilter.frequency.value = 2400; 
      this.lpfFilter.Q.value = 0.7;

      this.lmsNode = this.audioCtx.createDynamicsCompressor();
      this.lmsNode.threshold.value = -40;
      this.lmsNode.knee.value = 10;
      this.lmsNode.ratio.value = 12;
      this.lmsNode.attack.value = 0.003;
      this.lmsNode.release.value = 0.25;

      this.rebuildChain();
      
      return true;
    } catch (err) {
      console.error('Error accessing audio:', err);
      return false;
    }
  }

  setGain(percent: number) {
    this.currentGainPercent = percent;
    if (this.gainNode && this.audioCtx) {
      const gainValue = (percent / 50);
      this.gainNode.gain.setTargetAtTime(gainValue, this.audioCtx.currentTime, 0.01);
    }
  }

  private rebuildChain() {
    if (!this.source || !this.gainNode || !this.bpfFilter || !this.lpfFilter || !this.lmsNode || !this.analyser || !this.processor) return;

    this.source.disconnect();
    this.gainNode.disconnect();
    this.bpfFilter.disconnect();
    this.lpfFilter.disconnect();
    this.lmsNode.disconnect();
    this.analyser.disconnect();
    this.processor.disconnect();

    let lastNode: AudioNode = this.source;
    lastNode.connect(this.gainNode);
    lastNode = this.gainNode;

    if (this.noiseReductionEnabled) {
      lastNode.connect(this.lpfFilter);
      lastNode = this.lpfFilter;
    }

    if (this.bpfEnabled) {
      lastNode.connect(this.bpfFilter);
      lastNode = this.bpfFilter;
    }

    if (this.lmsEnabled) {
      lastNode.connect(this.lmsNode);
      lastNode = this.lmsNode;
    }

    lastNode.connect(this.analyser);
    this.analyser.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  setBpf(enabled: boolean, frequency: number, q: number) {
    this.bpfEnabled = enabled;
    if (this.bpfFilter && this.audioCtx) {
      this.bpfFilter.frequency.setTargetAtTime(frequency, this.audioCtx.currentTime, 0.01);
      this.bpfFilter.Q.setTargetAtTime(q, this.audioCtx.currentTime, 0.01);
    }
    this.rebuildChain();
  }

  setLms(enabled: boolean) {
    this.lmsEnabled = enabled;
    this.rebuildChain();
  }

  setNoiseReduction(enabled: boolean) {
    this.noiseReductionEnabled = enabled;
    this.rebuildChain();
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.audioCtx) {
      this.audioCtx.close();
    }
    this.audioCtx = null;
    this.analyser = null;
    this.processor = null;
    this.gainNode = null;
    this.bpfFilter = null;
    this.lpfFilter = null;
    this.lmsNode = null;
    this.onFrequencyCallback = null;
  }

  getFrequency(): { freq: number; level: number } {
    if (!this.analyser || !this.audioCtx) return { freq: 0, level: 0 };

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(dataArray);

    let maxVal = -Infinity;
    let maxIndex = -1;

    const minBin = Math.floor(800 * bufferLength / (this.audioCtx.sampleRate / 2));
    const maxBin = Math.ceil(2700 * bufferLength / (this.audioCtx.sampleRate / 2));

    for (let i = minBin; i < maxBin; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
        maxIndex = i;
      }
    }

    if (maxIndex === -1) return { freq: 0, level: 0 };

    let freq = maxIndex * (this.audioCtx.sampleRate / 2) / bufferLength;
    if (maxIndex > 0 && maxIndex < bufferLength - 1) {
      const alpha = dataArray[maxIndex - 1];
      const beta = dataArray[maxIndex];
      const gamma = dataArray[maxIndex + 1];
      const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
      freq = (maxIndex + p) * (this.audioCtx.sampleRate / 2) / bufferLength;
    }

    const level = Math.max(0, (maxVal + 90) / 60); 
    return { freq, level };
  }

  getByteFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}
