/**
 * Bangkok Plus Size OOTD - Real-Time Live API Voice Client
 * Connects to gemini-3.8-live over server-side WebSocket proxy.
 * Implements 16kHz microphone PCM capture, 24kHz gapless model response playback,
 * and immediate barge-in interruption handling.
 */

export interface LiveVoiceCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onListening?: (isListening: boolean) => void;
  onSpeaking?: (isSpeaking: boolean) => void;
  onTranscript?: (text: string, isUser: boolean) => void;
  onError?: (error: string) => void;
  onAudioLevel?: (level: number) => void;
}

export class LiveVoiceClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveVoiceCallbacks;
  private isConnected = false;
  private isMuted = false;

  constructor(callbacks: LiveVoiceCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/live-voice`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = async () => {
          this.isConnected = true;
          this.callbacks.onConnected?.();
          await this.initAudio();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onerror = (err) => {
          console.error('WebSocket Live Voice error:', err);
          this.callbacks.onError?.('Live Voice connection error. Check server logs.');
          reject(err);
        };

        this.ws.onclose = () => {
          this.cleanup();
          this.callbacks.onDisconnected?.();
        };
      } catch (err: any) {
        this.callbacks.onError?.(err?.message || 'Failed to initialize WebSocket');
        reject(err);
      }
    });
  }

  private async initAudio() {
    try {
      // 1. Setup Output AudioContext (24kHz for gemini-3.8-live)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      // 2. Setup Input AudioContext (16kHz for Live API input)
      this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      // 3. Request user microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      // Buffer size 2048 (~128ms chunks at 16kHz)
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Compute volume level for UI visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const avg = sum / inputData.length;
        this.callbacks.onAudioLevel?.(Math.min(1, avg * 5));

        // Convert Float32 to 16-bit PCM little-endian
        const pcmBase64 = this.floatToPcmBase64(inputData);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'audio', audio: pcmBase64 }));
        }
      };

      this.callbacks.onListening?.(true);
    } catch (micErr: any) {
      console.warn('Microphone permission not granted or audio error:', micErr);
      this.callbacks.onError?.('Microphone access denied. You can still test text-to-speech voice responses.');
    }
  }

  private handleServerMessage(data: any) {
    if (data.type === 'connected') {
      // Session confirmed by server
    } else if (data.type === 'audio' && data.audio) {
      this.callbacks.onSpeaking?.(true);
      this.playChunk(data.audio);
    } else if (data.type === 'text' && data.text) {
      this.callbacks.onTranscript?.(data.text, false);
    } else if (data.type === 'interrupted') {
      this.stopPlayback();
      this.callbacks.onSpeaking?.(false);
    } else if (data.type === 'turnComplete') {
      // Model finished turn
    } else if (data.type === 'error') {
      this.callbacks.onError?.(data.error);
    }
  }

  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
      this.callbacks.onTranscript?.(text, true);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.callbacks.onListening?.(!muted);
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Schedules raw 24kHz PCM chunks for gapless audio playback
   */
  private playChunk(base64Pcm: string) {
    if (!this.outputAudioCtx) return;

    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM LE to Float32
      const samplesCount = Math.floor(len / 2);
      const float32 = new Float32Array(samplesCount);
      const dataView = new DataView(bytes.buffer);

      for (let i = 0; i < samplesCount; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, samplesCount, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) this.activeSources.splice(idx, 1);
        if (this.activeSources.length === 0) {
          this.callbacks.onSpeaking?.(false);
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  private stopPlayback() {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch (e) {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  private floatToPcmBase64(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < uint8Array.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(uint8Array.subarray(i, i + chunk)));
    }
    return btoa(binary);
  }

  public disconnect() {
    this.cleanup();
  }

  private cleanup() {
    this.isConnected = false;
    this.stopPlayback();

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.callbacks.onListening?.(false);
    this.callbacks.onSpeaking?.(false);
  }
}
