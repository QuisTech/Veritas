import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PluginConsole, PluginConsoleRef } from './PluginConsole';
import { GoogleGenAI, Modality } from "@google/genai";
import { User } from 'lucide-react';

// Script designed for 1920x1080 roughly, utilizing percentages where possible
type ScriptStep = 
  | { type: 'cursor'; targetId?: string; x?: number | string; y?: number | string; delay?: number }
  | { type: 'click'; targetId?: string; delay?: number }
  | { type: 'subtitle'; text: string; delay?: number }
  | { type: 'log'; text: string; delay?: number }
  | { type: 'event'; eventType: string; message: string; delay?: number }
  | { type: 'scroll'; targetId?: string; y: number; delay?: number } // y matches scrollTop
  | { type: 'wait'; delay: number }
  | { type: 'type'; targetId: string; text: string; delay?: number }; // New type action

const SCRIPT: ScriptStep[] = [
    // --- 0:00 - 0:15: INTRODUCTION ---
    { type: 'cursor', x: '50%', y: '50%', delay: 1000 },
    { type: 'subtitle', text: 'Initializing VERITAS Protocol. System integrity check complete.', delay: 2000 },
    { type: 'log', text: '[System] VERITAS Core v3.1 initialized' },
    { type: 'subtitle', text: 'Welcome to the Director Mode demonstration. I am your forensic AI assistant.', delay: 3000 },
    
    // --- MODE SELECTION ---
    { type: 'subtitle', text: 'We begin by selecting the Forensic Form mode for deep artifact analysis.', delay: 2000 },
    { type: 'cursor', targetId: 'mode-toggle-form', delay: 1500 }, // Move to Form Mode
    { type: 'wait', delay: 800 }, // Hover
    { type: 'click', targetId: 'mode-toggle-form', delay: 500 }, // Click Form Mode
    { type: 'log', text: '[Mode] Switching context to FORENSIC_FORM' },
    
    // --- INPUT ARTIFACT ---
    { type: 'subtitle', text: 'I will now ingest a suspicious artifact detected on social media channels.', delay: 2000 },
    { type: 'cursor', targetId: 'artifact-input', delay: 1500 }, // Move to Input
    { type: 'click', targetId: 'artifact-input', delay: 500 }, // Click Input
    { type: 'type', targetId: 'artifact-input', text: 'BREAKING: Leaked internal memo confirms Mars colony established in 2024. #MarsTruth', delay: 500 },
    { type: 'log', text: '[Input] Artifact ingested: "Mars Colony Memo"' },
    
    // --- RUN ANALYSIS ---
    { type: 'subtitle', text: 'Initiating multimodal analysis. Scanning for semantic inconsistencies and fabrication markers.', delay: 2000 },
    { type: 'cursor', targetId: 'run-forensics-btn', delay: 1500 }, // Move to Run Button
    { type: 'wait', delay: 1000 }, // Dramatic pause
    { type: 'click', targetId: 'run-forensics-btn', delay: 500 }, // Click Run
    { type: 'log', text: '[Gemini] Analyzing semantic vectors...' },
    { type: 'log', text: '[Gemini] Checking cross-reference databases...' },
    
    // --- WAIT FOR ANALYSIS ---
    { type: 'subtitle', text: 'Processing... The system is cross-referencing global databases and analyzing linguistic patterns.', delay: 4000 },
    { type: 'wait', delay: 4000 }, // Wait for analysis to complete (simulated)
    
    // --- SCROLL TO RESULTS ---
    { type: 'subtitle', text: 'Analysis complete. Reviewing the Forensic Dossier.', delay: 2000 },
    { type: 'scroll', targetId: 'window', y: 800, delay: 1000 }, // Scroll down
    { type: 'log', text: '[System] Dossier generated successfully' },
    
    // --- VERDICT ---
    { type: 'cursor', targetId: 'forensic-results', delay: 1000 },
    { type: 'subtitle', text: 'Verdict: High Probability of Fabrication. Threat Level is HIGH.', delay: 3000 },
    { type: 'log', text: '[Verdict] Threat Level: HIGH' },
    
    // --- DOWNLOAD REPORT ---
    { type: 'subtitle', text: 'Generating and downloading the official forensic report for chain of custody.', delay: 2000 },
    { type: 'cursor', targetId: 'download-pdf-btn', delay: 1500 },
    { type: 'click', targetId: 'download-pdf-btn', delay: 500 },
    { type: 'log', text: '[System] PDF Report Downloaded' },
    { type: 'wait', delay: 2000 },

    // --- TRANSITION TO LIVE MODE ---
    { type: 'scroll', targetId: 'window', y: 0, delay: 1000 }, // Scroll up
    { type: 'subtitle', text: 'Now, let us switch to Live Interrogation mode for real-time voice analysis.', delay: 2000 },
    { type: 'cursor', targetId: 'mode-toggle-live', delay: 1500 },
    { type: 'click', targetId: 'mode-toggle-live', delay: 500 },
    { type: 'log', text: '[Mode] Switching context to LIVE_INTERROGATION' },

    // --- LIVE INTERROGATION ---
    { type: 'subtitle', text: 'Establishing secure uplink to the Gemini Live neural core.', delay: 2000 },
    { type: 'cursor', targetId: 'live-connect-btn', delay: 1500 },
    { type: 'click', targetId: 'live-connect-btn', delay: 500 },
    { type: 'log', text: '[System] Uplink Established' },
    { type: 'wait', delay: 2000 },

    { type: 'subtitle', text: 'I am now listening. I can analyze voice stress patterns and verify spoken claims in real-time.', delay: 4000 },
    { type: 'wait', delay: 3000 },

    // --- EVIDENCE LINK ---
    { type: 'subtitle', text: 'Injecting additional evidence link for context verification.', delay: 2000 },
    { type: 'cursor', targetId: 'live-evidence-input', delay: 1500 },
    { type: 'click', targetId: 'live-evidence-input', delay: 500 },
    { type: 'type', targetId: 'live-evidence-input', text: 'https://x.com/MarsTruth/status/17654321', delay: 500 },
    { type: 'cursor', targetId: 'live-evidence-send-btn', delay: 1000 },
    { type: 'click', targetId: 'live-evidence-send-btn', delay: 500 },
    { type: 'log', text: '[Live] Evidence link injected' },
    { type: 'wait', delay: 2000 },

    // --- DISCONNECT ---
    { type: 'subtitle', text: 'Interrogation complete. Terminating session.', delay: 2000 },
    { type: 'cursor', targetId: 'live-disconnect-btn', delay: 1500 },
    { type: 'click', targetId: 'live-disconnect-btn', delay: 500 },
    { type: 'log', text: '[System] Session Terminated' },

    // --- OUTRO ---
    { type: 'subtitle', text: 'VERITAS: Uncovering the Truth. Demonstration concluded.', delay: 3000 },
    { type: 'event', eventType: 'System', message: 'Analysis Complete' },
    { type: 'cursor', x: '95%', y: '95%', delay: 1000 },
];

export function DirectorMode({ apiKey, onClose }: { apiKey: string, onClose: () => void }) {
    // Initialize Gemini Client
    const ai = new GoogleGenAI({ apiKey });
    
    const [subtitle, setSubtitle] = useState('');
    const [cursorPos, setCursorPos] = useState({ x: 100, y: 100 });
    const [isClicking, setIsClicking] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const webcamRef = useRef<HTMLVideoElement>(null); 
    const consoleRef = useRef<PluginConsoleRef>(null);

    const generateSpeech = async (text: string): Promise<string | null> => {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Say: ${text}` }] }],
                config: {
                    responseModalities: ['AUDIO'] as any,
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                return `data:audio/mp3;base64,${base64Audio}`;
            }
            return null;
        } catch (error: any) {
            // Gracefully handle quota limits
            if (error.message?.includes('429') || error.status === 'RESOURCE_EXHAUSTED' || error.message?.includes('quota')) {
                console.warn("TTS Quota exceeded. Switching to native speech synthesis.");
                return null;
            }
            console.error("TTS Generation failed:", error);
            return null;
        }
    };

    const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
        return new Promise((resolve) => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve(voices);
                return;
            }
            
            const onVoicesChanged = () => {
                voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve(voices);
                }
            };
            
            window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
            // Fallback if event never fires - INCREASED TO 4000ms
            setTimeout(() => {
                window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                resolve(window.speechSynthesis.getVoices()); // Try one last time
            }, 4000);
        });
    };

    const speak = async (text: string) => {
        const audioUrl = await generateSpeech(text);
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            await new Promise<void>((resolve) => {
                audio.onended = () => resolve();
                audio.play().catch(e => {
                    console.warn("Audio playback failed:", e);
                    resolve(); // Continue even if audio fails
                });
            });
        } else {
            // Fallback to synthesis if API fails
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                
                // Wait for voices to load
                const voices = await loadVoices();
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0; // Slightly faster for better flow
                utterance.pitch = 1.0;
                
                // Try to select a better voice
                // Priority: Google US English > Microsoft Natural > Apple Samantha > Any Google English > Any English
                const preferredVoice = voices.find(v => 
                    v.name === 'Google US English' || 
                    v.name.includes('Google US English') ||
                    (v.name.includes('Microsoft') && v.name.includes('Natural') && v.lang.startsWith('en')) ||
                    v.name.includes('Samantha') ||
                    v.name.includes('Daniel') ||
                    (v.name.includes('Google') && v.lang.startsWith('en'))
                );

                // FALLBACK: Any English voice if preferred not found
                const fallbackVoice = voices.find(v => v.lang.startsWith('en'));
                
                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                    // Adjust rate slightly for specific voices if needed
                    if (preferredVoice.name.includes('Google')) utterance.rate = 0.95;
                } else if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                }

                // Small delay to ensure browser is ready
                await new Promise(r => setTimeout(r, 100));

                window.speechSynthesis.speak(utterance);
                await new Promise<void>(resolve => {
                    utterance.onend = () => resolve();
                    // Safety timeout in case onend doesn't fire
                    setTimeout(resolve, (text.length * 100) + 2000);
                });
            }
        }
    };

    const startRecordingFlow = async () => {
        try {
            // Webcam
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                if (webcamRef.current) {
                    webcamRef.current.srcObject = camStream;
                    await webcamRef.current.play();
                    setIsCameraActive(true);
                }
            } catch (e) {
                console.warn("No camera found or permission denied", e);
                setIsCameraActive(false);
            }

            // Screen Share
            // ... (rest of the function)
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: { displaySurface: "browser" }, 
                    audio: false
                });
                
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data);
                };
                recorder.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `veritas-audit-demo-final-${Date.now()}.webm`;
                    a.click();
                };
                
                mediaRecorderRef.current = recorder;
                recorder.start();
            } catch (e) {
                console.warn("Screen recording disallowed or cancelled. Continuing in demo-only mode.", e);
                consoleRef.current?.log("Screen recording unavailable. Running visual demo.", 'error');
            }
            
            // Countdown
            for (let i = 5; i > 0; i--) {
                setSubtitle(`Initializing Director Mode in ${i}...`);
                await new Promise(r => setTimeout(r, 1000));
            }
            setSubtitle(""); 
            
            runScript();
            
        } catch (err) {
            console.error("Director Mode failed:", err);
            onClose();
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const runScript = async () => {
        for (const step of SCRIPT) {
            if (step.type === 'subtitle') {
                setSubtitle(step.text);
                // Speak and wait for speech to finish before moving to next step delay
                await speak(step.text);
            }
            else if (step.type === 'log') {
                consoleRef.current?.log(step.text, 'info');
            }
            
            // Handle Cursor Movement
            let nextPos = null;
            
            if ('targetId' in step && step.targetId) {
                const el = document.getElementById(step.targetId);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    nextPos = { 
                        x: rect.left + rect.width / 2, 
                        y: rect.top + rect.height / 2 
                    };
                }
            } 
            else if (step.type === 'cursor' && step.x !== undefined && step.y !== undefined) {
                nextPos = {
                    x: typeof step.x === 'string' ? (parseFloat(step.x) / 100) * window.innerWidth : step.x,
                    y: typeof step.y === 'string' ? (parseFloat(step.y) / 100) * window.innerHeight : step.y
                };
            }

            if (nextPos) {
                setCursorPos(nextPos);
            }

            // Handle Clicks
            if (step.type === 'click') {
                setIsClicking(true);
                await new Promise(r => setTimeout(r, 200));
                
                if (step.targetId) {
                    const el = document.getElementById(step.targetId);
                    if (el) el.click();
                } else {
                    // Fallback to coordinates
                    const elem = document.elementFromPoint(cursorPos.x, cursorPos.y);
                    if (elem && elem instanceof HTMLElement) {
                        elem.click();
                        const btn = elem.closest('button') || elem.closest('select') || elem.closest('input');
                        if (btn && btn !== elem) btn.click();
                    }
                }
                
                await new Promise(r => setTimeout(r, 200));
                setIsClicking(false);
            }

            // Handle Typing
            if (step.type === 'type') {
                const el = document.getElementById(step.targetId);
                if (el) {
                    // Dispatch custom event for React to pick up
                    window.dispatchEvent(new CustomEvent('demo-type', { 
                        detail: { targetId: step.targetId, text: step.text } 
                    }));
                }
            }
            
            if (step.type === 'scroll') {
                if (step.targetId === 'window') {
                    window.scrollTo({ top: step.y, behavior: 'smooth' });
                } else if (step.targetId) {
                    const el = document.getElementById(step.targetId);
                    if (el) el.scrollTo({ top: step.y, behavior: 'smooth' });
                }
            }
            else if (step.type === 'event') {
                 consoleRef.current?.log(`[Event] ${step.eventType}`, 'success');
            }
            
            if (step.delay) await new Promise(r => setTimeout(r, step.delay));
        }
        
        stopRecording();
        setSubtitle("Saving Artifact...");
        setTimeout(onClose, 3000);
    };

    const hasStartedRef = useRef(false);
    useEffect(() => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;
        startRecordingFlow();
    }, []);

    return (
        <div className="director-overlay">
            {/* Virtual Mouse */}
            <motion.div 
                className="virtual-mouse"
                animate={{ x: cursorPos.x, y: cursorPos.y }}
                transition={{ duration: 1.2, ease: "easeInOut" }} 
            >
                <div className={`cursor-pointer ${isClicking ? 'cursor-clicking' : ''}`}></div>
            </motion.div>

            <AnimatePresence>
                {subtitle && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="demo-subtitle"
                        style={{ top: '20px', bottom: 'auto' }} // Move to top
                    >
                        {subtitle}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="webcam-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!isCameraActive && (
                    <User className="w-20 h-20 text-emerald-500/50" />
                )}
                <video 
                    ref={webcamRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="webcam-video" 
                    style={{ display: isCameraActive ? 'block' : 'none' }}
                    onLoadedMetadata={() => webcamRef.current?.play()}
                />
            </div>

            <PluginConsole ref={consoleRef} />

            <button className="stop-btn" onClick={() => { stopRecording(); onClose(); }}>
                <div style={{width: 10, height: 10, background: 'red', borderRadius: '50%'}}></div>
            </button>
        </div>
    );
}
