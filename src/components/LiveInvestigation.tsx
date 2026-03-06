import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Activity, Radio, Volume2, AlertCircle } from 'lucide-react';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Audio Context & Processing Constants
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export const LiveInvestigation: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  // Canvas ref for visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    try {
      setStatus('connecting');
      setErrorMessage('');

      // 1. Setup Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });

      // 2. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 3. Connect to Gemini Live API
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Connected");
            setStatus('connected');
            setIsConnected(true);
            setIsListening(true);
            startAudioProcessing(stream, sessionPromise);
          },
          onmessage: (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onclose: () => {
            console.log("Gemini Live Session Closed");
            disconnect();
          },
          onerror: (err) => {
            console.error("Gemini Live Session Error:", err);
            setErrorMessage(err.message || "Connection error");
            disconnect();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `
            You are VERITAS (Virtual Evidence Reconstruction & Intelligence Tracking Analysis System) in LIVE INTERROGATION MODE.
            
            Your Persona:
            - You are a highly advanced AI forensic investigator.
            - Your voice is calm, authoritative, and precise.
            - You sound like a mix of a high-tech computer (JARVIS) and a seasoned detective.
            - You are "listening" to the user describe evidence.
            
            Your Goal:
            - Interview the user about the suspicious media they are analyzing.
            - Ask probing questions to uncover inconsistencies (e.g., "Does the shadow angle match the time of day?", "Is the audio syncing with the lip movements?").
            - Guide them through a forensic analysis step-by-step.
            - If they provide a URL or description, analyze it (simulated for this voice mode) and give a verdict.
            
            Interaction Style:
            - Concise. Do not give long monologues.
            - Interruptible. If the user speaks, stop talking immediately.
            - Use technical forensic terminology (e.g., "artifacts", "metadata", "frame interpolation", "spectral analysis").
          `,
        },
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection Failed:", err);
      setErrorMessage(err.message || "Failed to access microphone or connect.");
      setStatus('error');
    }
  };

  const disconnect = () => {
    setStatus('disconnected');
    setIsConnected(false);
    setIsListening(false);
    setVolumeLevel(0);

    // Stop Audio Context & Stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Close Session
    if (sessionRef.current) {
      // sessionRef.current.close(); // The SDK might not expose close directly on the promise, but usually it handles cleanup on disconnect
      sessionRef.current = null;
    }

    // Stop Animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const startAudioProcessing = async (stream: MediaStream, sessionPromise: Promise<any>) => {
    if (!audioContextRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(BUFFER_SIZE, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      setVolumeLevel(rms);

      // Convert to PCM 16-bit and send
      const pcmData = floatTo16BitPCM(inputData);
      const base64Data = arrayBufferToBase64(pcmData);

      sessionPromise.then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Data,
          },
        });
      });
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination); // Connect to destination to keep it alive, but mute output if needed
    processorRef.current = processor;

    // Start Visualizer
    drawVisualizer();
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const serverContent = message.serverContent;

    if (serverContent?.modelTurn?.parts?.[0]?.inlineData) {
      const audioData = serverContent.modelTurn.parts[0].inlineData.data;
      if (audioData) {
        const pcmData = base64ToArrayBuffer(audioData);
        playAudioChunk(pcmData);
      }
    }

    if (serverContent?.interrupted) {
      console.log("Interrupted!");
      audioQueueRef.current = []; // Clear queue
      // Logic to stop current playback would go here if we were using a more complex audio player
    }
  };

  const playAudioChunk = (pcmData: ArrayBuffer) => {
    if (!audioContextRef.current) return;

    const float32Data = new Float32Array(pcmData.byteLength / 2);
    const dataView = new DataView(pcmData);

    for (let i = 0; i < pcmData.byteLength / 2; i++) {
      const int16 = dataView.getInt16(i * 2, true); // Little-endian
      float32Data[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    // Simple scheduling
    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  };

  // --- Helpers ---

  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(i * 2, s, true);
    }
    return buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const drawVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      // Draw waveform based on volumeLevel
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      
      // Simulated waveform for visual effect
      for (let i = 0; i < width; i++) {
        const amplitude = isListening ? volumeLevel * 100 : 0;
        const y = height / 2 + Math.sin(i * 0.05 + Date.now() * 0.01) * amplitude * Math.sin(i * 0.01);
        ctx.lineTo(i, y);
      }
      
      ctx.strokeStyle = '#10b981'; // Veritas Accent
      ctx.lineWidth = 2;
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="glass-panel p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden border border-veritas-accent/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
        
        {/* Background Grid Animation */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        {/* Status Header */}
        <div className="absolute top-6 left-6 flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-veritas-accent animate-pulse' : 'bg-slate-600'}`}></div>
          <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            {status === 'connected' ? 'LIVE_UPLINK_ESTABLISHED' : 'SYSTEM_STANDBY'}
          </span>
        </div>

        {/* Main Visualizer */}
        <div className="relative z-10 mb-12 w-full flex justify-center items-center h-48">
            {isConnected ? (
                <canvas ref={canvasRef} width={600} height={200} className="w-full max-w-lg" />
            ) : (
                <div className="text-center space-y-4 opacity-50">
                    <Radio className="h-16 w-16 text-slate-600 mx-auto" />
                    <p className="text-slate-500 font-mono text-sm">AWAITING AUDIO STREAM</p>
                </div>
            )}
        </div>

        {/* Controls */}
        <div className="relative z-10 flex flex-col items-center space-y-6">
          {status === 'error' && (
            <div className="flex items-center text-red-400 bg-red-900/20 px-4 py-2 rounded-md border border-red-500/30 mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {!isConnected ? (
            <button
              onClick={connect}
              disabled={status === 'connecting'}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-mono font-bold text-white transition-all duration-200 bg-veritas-accent/10 font-lg rounded-full border border-veritas-accent/50 hover:bg-veritas-accent/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-veritas-accent focus:ring-offset-slate-900"
            >
              {status === 'connecting' ? (
                <>
                   <Activity className="w-5 h-5 mr-2 animate-spin" />
                   ESTABLISHING UPLINK...
                </>
              ) : (
                <>
                   <Mic className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                   INITIATE LIVE INTERROGATION
                </>
              )}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-mono font-bold text-red-400 transition-all duration-200 bg-red-500/10 font-lg rounded-full border border-red-500/50 hover:bg-red-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-slate-900"
            >
              <MicOff className="w-5 h-5 mr-2" />
              TERMINATE SESSION
            </button>
          )}

          <p className="text-slate-500 text-xs font-mono max-w-md text-center">
            {isConnected 
              ? "VERITAS IS LISTENING. SPEAK NATURALLY TO ANALYZE EVIDENCE." 
              : "ENABLE MICROPHONE ACCESS FOR REAL-TIME FORENSIC INTERVIEW."}
          </p>
        </div>

        {/* Decorative Elements */}
        <div className="absolute bottom-4 right-4 flex items-center space-x-2 text-slate-600">
            <Volume2 className="h-4 w-4" />
            <div className="h-1 w-16 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-veritas-accent transition-all duration-100" style={{ width: `${Math.min(volumeLevel * 500, 100)}%` }}></div>
            </div>
        </div>

      </div>
    </div>
  );
};
