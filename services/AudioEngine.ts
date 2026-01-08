
export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  
  // DSP Nodes
  private bpfFilter: BiquadFilterNode | null = null;
  private lpfFilter: BiquadFilterNode | null = null;
  private lmsNode: DynamicsCompressorNode | null = null;
  
  // States
  private bpfEnabled = false;
  private lmsEnabled = false;
  private noiseReductionEnabled = false;

  static async getDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // First, request permission to ensure device labels are available
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return [];
    }
  }

  async start(deviceId?: string): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 4096;
      
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      
      // Initialize Filters
      this.bpfFilter = this.audioCtx.createBiquadFilter();
      this.bpfFilter.type = 'bandpass';
      this.bpfFilter.frequency.value = 1700; // Center of SSTV range
      this.bpfFilter.Q.value = 1.0;

      this.lpfFilter = this.audioCtx.createBiquadFilter();
      this.lpfFilter.type = 'lowpass';
      this.lpfFilter.frequency.value = 2400; // Cutoff above white frequency
      this.lpfFilter.Q.value = 0.7;

      this.lmsNode = this.audioCtx.createDynamicsCompressor();
      // Aggressive settings for "LMS-like" adaptive gain leveling
      this.lmsNode.threshold.value = -30;
      this.lmsNode.knee.value = 0;
      this.lmsNode.ratio.value = 20;
      this.lmsNode.attack.value = 0.005;
      this.lmsNode.release.value = 0.050;

      this.rebuildChain();
      
      return true;
    } catch (err) {
      console.error('Error accessing audio:', err);
      return false;
    }
  }

  private rebuildChain() {
    if (!this.source || !this.bpfFilter || !this.lpfFilter || !this.lmsNode || !this.analyser) return;

    this.source.disconnect();
    this.bpfFilter.disconnect();
    this.lpfFilter.disconnect();
    this.lmsNode.disconnect();

    let lastNode: AudioNode = this.source;

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
  }

  setBpf(enabled: boolean, width: 'narrow' | 'medium' | 'wide' = 'medium') {
    this.bpfEnabled = enabled;
    if (this.bpfFilter) {
      // Adjust Q factor for width (Higher Q = Narrower Band)
      const qValues = { narrow: 4.0, medium: 1.5, wide: 0.7 };
      this.bpfFilter.Q.value = qValues[width];
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
    this.audioCtx?.close();
    this.audioCtx = null;
    this.analyser = null;
    this.bpfFilter = null;
    this.lpfFilter = null;
    this.lmsNode = null;
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

    let freq = maxIndex * (this.audioCtx.sampleRate / 2) / bufferLength;
    if (maxIndex > 0 && maxIndex < bufferLength - 1) {
      const alpha = dataArray[maxIndex - 1];
      const beta = dataArray[maxIndex];
      const gamma = dataArray[maxIndex + 1];
      const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
      freq = (maxIndex + p) * (this.audioCtx.sampleRate / 2) / bufferLength;
    }

    const level = Math.max(0, (maxVal + 100) / 100);
    return { freq, level };
  }

  getByteFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}
