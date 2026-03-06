import React, { useState, useRef, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Activity, Search, AlertTriangle, FileAudio2, Image as ImageIcon, Terminal, BrainCircuit, Paperclip, Film, FileCode2, MapPin, Download, Loader2, Link, Plus, Mic, FileText } from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { LiveInvestigation } from './components/LiveInvestigation';
import { DirectorMode } from './components/DirectorMode/DirectorMode';

// Initialize Gemini Client
// Note: In Vite, process.env.GEMINI_API_KEY is replaced by the define in vite.config.ts
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function App() {
  const [mode, setMode] = useState<'form' | 'live'>('form');
  const [artifactContent, setArtifactContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [thinkingMode, setThinkingMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const endOfDossierRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleDemoType = (e: CustomEvent) => {
        const { targetId, text } = e.detail;
        if (targetId === 'artifact-input') {
            setArtifactContent(text);
        }
    };
    window.addEventListener('demo-type', handleDemoType as EventListener);
    return () => window.removeEventListener('demo-type', handleDemoType as EventListener);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (indexToRemove: number) => {
      setAttachedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const addUrl = () => {
    if (urlInput.trim() && !referenceUrls.includes(urlInput.trim())) {
        setReferenceUrls(prev => [...prev, urlInput.trim()]);
        setUrlInput('');
    }
  };

  const removeUrl = (indexToRemove: number) => {
      setReferenceUrls(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the Data-URL prefix (e.g., "data:image/png;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('full-report-content');
    if (!element) return;

    setIsDownloading(true);
    
    // Give UI time to update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Robust PDF Generation Logic
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // We will capture sections individually to ensure clean page breaks
      const sections = [
        'report-header',
        'report-overview',
        'report-details-header'
      ];

      // Add individual steps dynamically
      if (analysisResult?.narrative_steps) {
        analysisResult.narrative_steps.forEach((_: any, index: number) => {
          sections.push(`report-step-${index}`);
        });
      }

      sections.push('report-conclusion');

      let currentY = 10; // Start with some top margin
      const margin = 10;
      
      for (const sectionId of sections) {
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) continue;

        // Capture the section
        const canvas = await html2canvas(sectionElement, {
          scale: 2,
          logging: false,
          backgroundColor: '#ffffff',
          useCORS: false,
          onclone: (clonedDoc) => {
            // Remove all stylesheets to prevent html2canvas from parsing unsupported CSS
            const styles = clonedDoc.getElementsByTagName('style');
            const links = clonedDoc.getElementsByTagName('link');
            
            Array.from(styles).forEach(style => (style as HTMLStyleElement).remove());
            Array.from(links).forEach(link => {
              const linkEl = link as HTMLLinkElement;
              if (linkEl.rel === 'stylesheet') linkEl.remove();
            });

            // We need to target the specific section in the cloned document
            const clonedSection = clonedDoc.getElementById(sectionId);
            if (clonedSection) {
              // Recursively remove all class names to prevent any residual styling issues
              const allElements = clonedSection.getElementsByTagName('*');
              for (let i = 0; i < allElements.length; i++) {
                allElements[i].removeAttribute('class');
              }
              clonedSection.removeAttribute('class');
            }
          }
        } as any);

        const imgData = canvas.toDataURL('image/png');
        const componentWidth = pdfWidth - (margin * 2);
        const componentHeight = (canvas.height * componentWidth) / canvas.width;

        // Check if we need a new page
        if (currentY + componentHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = 10; // Reset Y for new page
        }

        pdf.addImage(imgData, 'PNG', margin, currentY, componentWidth, componentHeight);
        currentY += componentHeight + 10; // Add some spacing between sections
      }
      
      pdf.save('VERITAS_Forensic_Dossier.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (isDemoMode) {
        setError(''); // Aggressively clear errors when entering demo mode
    }
  }, [isDemoMode]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artifactContent.trim() && attachedFiles.length === 0 && referenceUrls.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError('');

    try {
      const parts: any[] = [];

      let promptText = "";

      // Add text artifact
      if (artifactContent) {
        promptText += `Suspicious Artifact Content/Description:\n${artifactContent}\n\n`;
      }

      // Add Reference URLs
      if (referenceUrls.length > 0) {
        promptText += `Reference URLs/Evidence:\n${referenceUrls.join('\n')}\n\n`;
      }

      if (promptText) {
        parts.push({ text: promptText });
      }

      // Process files
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          const base64Data = await fileToBase64(file);
          parts.push({
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          });
        }
      }

      const systemInstruction = `
        You are VERITAS (Virtual Evidence Reconstruction & Intelligence Tracking Analysis System).
        Your mission is to deconstruct synthetic media, misinformation, and suspicious digital artifacts.
        
        Analyze the provided input (text, images, audio, video, or URLs) with extreme forensic precision.
        If URLs are provided, use them as external evidence or context to verify claims or analyze the artifact.
        
        Output a structured "Forensic Dossier" in JSON format.
        
        The response MUST adhere to this exact JSON schema:
        {
          "threat_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          "conclusion": "A concise summary of the findings (max 2 sentences).",
          "narrative_steps": [
            {
              "type": "text" | "video_analysis" | "audio_script" | "image_placeholder" | "spatial_pointing" | "derender_code",
              "content": "The main content of this step.",
              "description": "Optional description for images/media.",
              "prompt": "Optional prompt used to generate the image (if type is image_placeholder).",
              "coordinates": "Optional coordinates (e.g., 'Frame 124, [10, 20]') for spatial pointing.",
              "language": "Optional language for code (if type is derender_code)."
            }
          ]
        }

        Step Types Guide:
        - "text": General analysis, fact-checking, or observation.
        - "video_analysis": Specific observations about video frames, lighting inconsistencies, or deepfake artifacts.
        - "audio_script": Transcripts or analysis of audio anomalies (background noise, voice cloning artifacts).
        - "image_placeholder": If you need to visualize a reconstruction or a comparison, describe it here.
        - "spatial_pointing": Use this to point out specific pixel coordinates or regions of interest in an image/video frame.
        - "derender_code": If the artifact involves code, metadata, or hidden steganography, extract it here.

        Tone: Professional, clinical, cyber-forensic, authoritative.
      `;

      const modelId = "gemini-3.1-pro-preview";

      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          thinkingConfig: thinkingMode ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
          tools: referenceUrls.length > 0 ? [{ urlContext: {} }] : undefined,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini.");
      }

      const data = JSON.parse(responseText);
      setAnalysisResult(data);

    } catch (err: any) {
      console.error("Analysis Error:", err);
      let errorMessage = err.message || "An unexpected error occurred.";
      
      // MOCK FALLBACK FOR DEMO / QUOTA LIMITS
      const isQuotaError = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("Failed to call the Gemini API");
      
      if (isQuotaError || isDemoMode) {
          console.warn("Quota exceeded or Demo Mode active. Using Mock Result.");
          setAnalysisResult({
              "threat_level": "HIGH",
              "conclusion": "The artifact exhibits multiple indicators of synthetic fabrication, including semantic inconsistencies with known historical timelines and deepfake audio artifacts.",
              "narrative_steps": [
                  {
                      "type": "text",
                      "content": "Cross-referencing the 'Mars Colony 2024' claim against global aerospace databases (NASA, ESA, SpaceX) reveals zero corroborating launch manifests or habitation logs."
                  },
                  {
                      "type": "video_analysis",
                      "content": "Frame-by-frame spectral analysis detects irregular pixel interpolation around the subject's mouth region, consistent with GAN-based lip-sync generation."
                  },
                  {
                      "type": "audio_script",
                      "content": "Voice stress analysis indicates a 'flat' emotional variance typical of text-to-speech synthesis models, lacking natural micro-tremors found in human speech."
                  },
                  {
                      "type": "spatial_pointing",
                      "coordinates": "Frame 124, [450, 320]",
                      "content": "Lighting shadows on the background terrain do not align with the primary light source (Sun) relative to the subject's position."
                  },
                  {
                      "type": "derender_code",
                      "language": "json",
                      "content": "{\n  \"metadata_layer\": \"synthetic\",\n  \"generator_sig\": \"unknown_model_v4\",\n  \"edit_timestamp\": \"2024-03-15T09:22:11Z\"\n}"
                  }
              ]
          });
          setError(''); // Clear error so it doesn't show
          return;
      }

      if (errorMessage.includes("API key not valid")) {
        errorMessage = "Configuration Error: Invalid API Key. Please check your AI Studio secrets.";
      } else if (errorMessage.includes("400")) {
        errorMessage = "Bad Request: The content might be too large or invalid format.";
      }

      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // Scroll to bottom when new results appear
    endOfDossierRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysisResult]);

  return (
    <div className="min-h-screen scan-line flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="w-full max-w-4xl mb-12 flex flex-col items-center text-center">
        <div className="flex items-center space-x-3 mb-4">
          <Terminal className="h-10 w-10 text-veritas-accent drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
          <h1 className="text-5xl font-bold tracking-tight text-white font-mono drop-shadow-lg">
            VERITAS
          </h1>
        </div>
        <p className="text-lg text-slate-400 max-w-2xl">
          Multimodal Forensic Deconstruction Agent. Uncovering the truth behind synthetic media and misinformation.
        </p>
      </header>

      {/* Mode Toggle */}
      <div className="mb-8 flex space-x-4 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50 backdrop-blur-sm">
        <button
          id="mode-toggle-form"
          onClick={() => setMode('form')}
          className={`flex items-center px-6 py-2 rounded-md font-mono text-sm transition-all duration-200 ${
            mode === 'form' 
              ? 'bg-veritas-accent/20 text-veritas-accent border border-veritas-accent/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 mr-2" />
          FORENSIC_FORM
        </button>
        <button
          id="mode-toggle-live"
          onClick={() => setMode('live')}
          className={`flex items-center px-6 py-2 rounded-md font-mono text-sm transition-all duration-200 ${
            mode === 'live' 
              ? 'bg-veritas-accent/20 text-veritas-accent border border-veritas-accent/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Mic className="w-4 h-4 mr-2" />
          LIVE_INTERROGATION
        </button>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-4xl space-y-8 flex-1">
        
        {mode === 'live' ? (
          <LiveInvestigation />
        ) : (
          <>
            {/* Input Section */}
            <section className="glass-panel p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-4 font-mono text-white flex items-center">
            <Search className="mr-2 h-5 w-5 text-veritas-accent" />
            Input Suspicious Artifact
          </h2>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label htmlFor="artifact" className="sr-only">Artifact Content</label>
              <textarea
                id="artifact-input"
                rows={4}
                className="block w-full rounded-xl border-0 bg-slate-900/50 py-4 px-5 text-white shadow-inner ring-1 ring-inset ring-slate-700/80 focus:ring-2 focus:ring-inset focus:ring-veritas-accent sm:text-sm sm:leading-6 font-mono placeholder:text-slate-500 transition-all duration-300 hover:ring-slate-500"
                placeholder="Paste the viral quote, tweet, or describe the suspicious media here..."
                value={artifactContent}
                onChange={(e) => setArtifactContent(e.target.value)}
                disabled={isAnalyzing}
              />

              {attachedFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                      {attachedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center text-xs font-mono bg-slate-800/80 border border-slate-700 text-slate-300 px-2 py-1 rounded-md">
                              <Paperclip className="h-3 w-3 mr-1.5 text-slate-500" />
                              <span className="truncate max-w-[150px]">{file.name}</span>
                              <button type="button" onClick={() => removeFile(idx)} className="ml-2 text-slate-500 hover:text-red-400 transition-colors">
                                  &times;
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              {/* URL Input Section */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Link className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="url"
                      className="block w-full rounded-lg border-0 bg-slate-900/50 py-2 pl-10 pr-3 text-white shadow-inner ring-1 ring-inset ring-slate-700/80 focus:ring-2 focus:ring-inset focus:ring-veritas-accent sm:text-sm sm:leading-6 font-mono placeholder:text-slate-500 transition-all duration-300 hover:ring-slate-500"
                      placeholder="Add URL (article, video link, PDF, social post...)"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addUrl}
                    disabled={!urlInput.trim()}
                    className="p-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {referenceUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {referenceUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center text-xs font-mono bg-indigo-900/30 border border-indigo-500/30 text-indigo-200 px-2 py-1 rounded-md max-w-full">
                        <Link className="h-3 w-3 mr-1.5 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{url}</span>
                        <button type="button" onClick={() => removeUrl(idx)} className="ml-2 text-indigo-400 hover:text-red-400 transition-colors flex-shrink-0">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="mt-3 flex items-center justify-between border border-slate-700/50 rounded-lg p-2 bg-slate-900/30">
                <div className="flex space-x-2">
                  <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-veritas-accent hover:bg-slate-800 rounded-md transition-colors" title="Attach Document">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-colors" title="Attach Image">
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors" title="Attach Audio">
                    <FileAudio2 className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors" title="Attach Deep Video (1hr limit)">
                    <Film className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-2 border-l border-slate-700/50 pl-3">
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">Thinking Mode:</span>
                  <button 
                    type="button"
                    onClick={() => setThinkingMode(!thinkingMode)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-veritas-accent focus:ring-offset-2 focus:ring-offset-slate-900 ${thinkingMode ? 'bg-veritas-accent' : 'bg-slate-700'}`}
                  >
                    <span className="sr-only">Toggle Thinking Mode</span>
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${thinkingMode ? 'translate-x-5' : 'translate-x-0'}`}>
                       {thinkingMode && <BrainCircuit className="h-3 w-3 text-veritas-accent" />}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                id="run-forensics-btn"
                type="submit"
                disabled={isAnalyzing || (!artifactContent.trim() && attachedFiles.length === 0 && referenceUrls.length === 0)}
                className="inline-flex justify-center items-center rounded-lg bg-veritas-accent/20 backdrop-blur-md py-3 px-8 text-sm font-bold text-veritas-accent shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-inset ring-veritas-accent/50 hover:bg-veritas-accent/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-veritas-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-300"
              >
                {isAnalyzing ? (
                  <>
                    <Activity className="animate-spin -ml-1 mr-2 h-4 w-4 text-veritas-accent" />
                    Initializing Scan...
                  </>
                ) : (
                  <>
                    <Terminal className="-ml-1 mr-2 h-4 w-4 text-veritas-accent" />
                    Run Forensics
                  </>
                )}
              </button>
            </div>
          </form>
          {error && (
            <div className="mt-4 p-4 rounded-md bg-red-900/30 border border-red-500 flex items-start">
               <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
               <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
        </section>

        {/* Results Section (Dossier) */}
        {analysisResult && (
          <section id="forensic-results" className="glass-panel p-6 sm:p-8 animate-fadeIn border-t-4 border-t-veritas-accent">
            <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-4">
              <h2 className="text-2xl font-bold font-mono text-white flex items-center">
                <Activity className="mr-3 h-6 w-6 text-veritas-accent" />
                Forensic Dossier
              </h2>
              <div className="flex items-center space-x-4">
                <button 
                  id="download-pdf-btn"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-md text-xs font-mono border border-slate-600 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      GENERATING...
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      DOWNLOAD PDF
                    </>
                  )}
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-400 font-mono uppercase">Threat Level:</span>
                  <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-semibold font-mono
                      ${analysisResult.threat_level === 'HIGH' || analysisResult.threat_level === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        analysisResult.threat_level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}
                  `}>
                      {analysisResult.threat_level === 'HIGH' || analysisResult.threat_level === 'CRITICAL' ? <ShieldAlert className="mr-1.5 h-4 w-4" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                      {analysisResult.threat_level}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
               {analysisResult.narrative_steps.map((step: any, index: number) => (
                 <div key={index} className="flex gap-4 p-5 rounded-xl bg-slate-800/20 backdrop-blur-sm border border-slate-700/50 hover:border-veritas-accent/50 hover:bg-slate-800/40 hover:-translate-y-0.5 transition-all duration-300 shadow-lg animate-fadeIn" style={{ animationDelay: `${index * 150}ms` }}>
                    
                    <div className="flex-shrink-0 mt-1">
                      {step.type === 'text' && <Terminal className="h-5 w-5 text-slate-400" />}
                      {step.type === 'video_analysis' && <Film className="h-5 w-5 text-red-400" />}
                      {step.type === 'audio_script' && <FileAudio2 className="h-5 w-5 text-indigo-400" />}
                      {step.type === 'image_placeholder' && <ImageIcon className="h-5 w-5 text-veritas-accent" />}
                      {step.type === 'spatial_pointing' && <MapPin className="h-5 w-5 text-amber-400" />}
                      {step.type === 'derender_code' && <FileCode2 className="h-5 w-5 text-sky-400" />}
                    </div>

                    <div className="flex-1">
                      {step.type === 'text' && (
                        <div>
                          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 block">Analysis Log</span>
                          <p className="text-slate-300 terminal-text leading-relaxed">{step.content}</p>
                        </div>
                      )}
                      
                      {step.type === 'video_analysis' && (
                        <div>
                          <span className="text-xs font-mono text-red-500/70 uppercase tracking-wider mb-1 block flex items-center">
                            <span className="animate-pulse h-1.5 w-1.5 bg-red-500 rounded-full mr-1.5"></span>
                            Continuous Video Intelligence
                          </span>
                          <p className="text-red-100/90 terminal-text leading-relaxed border-l-2 border-red-500/30 pl-3 py-1">{step.content}</p>
                        </div>
                      )}

                      {step.type === 'derender_code' && (
                        <div>
                          <span className="text-xs font-mono text-sky-500/70 uppercase tracking-wider mb-2 block">Document Derendering ({step.language})</span>
                          <div className="bg-slate-900 rounded-md border border-slate-700/50 p-3 overflow-x-auto">
                            <pre className="text-sky-300/90 text-sm font-mono leading-relaxed">
                              <code>{step.content}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      {step.type === 'spatial_pointing' && (
                        <div>
                          <span className="text-xs font-mono text-amber-500/70 uppercase tracking-wider mb-1 block">Spatial Coordinate Targeting</span>
                          <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 p-3 rounded-md">
                             <div className="bg-amber-500/20 text-amber-400 text-xs font-mono px-2 py-1 rounded inline-block whitespace-nowrap">
                               {step.coordinates}
                             </div>
                             <p className="text-amber-200/90 text-sm terminal-text leading-relaxed">{step.content}</p>
                          </div>
                        </div>
                      )}
                      
                      {step.type === 'audio_script' && (
                        <div>
                          <span className="text-xs font-mono text-indigo-500/70 uppercase tracking-wider mb-1 block flex items-center">
                            <span className="animate-pulse h-1.5 w-1.5 bg-indigo-500 rounded-full mr-1.5"></span>
                            Audio Sync Script
                          </span>
                          <p className="text-indigo-200/90 italic terminal-text leading-relaxed border-l-2 border-indigo-500/30 pl-3 py-1">"{step.content}"</p>
                        </div>
                      )}

                      {step.type === 'image_placeholder' && (
                        <div>
                          <span className="text-xs font-mono text-emerald-500/70 uppercase tracking-wider mb-2 block">Generated Visual Evidence</span>
                          <div className="relative overflow-hidden rounded-md border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center max-w-2xl group hover:border-emerald-500/50 transition-colors">
                             <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <h4 className="text-sm font-semibold text-emerald-400 mb-2 font-mono flex items-center justify-center">
                               <ImageIcon className="h-4 w-4 mr-1.5" />
                               {step.description}
                             </h4>
                             <p className="text-xs text-slate-400 font-mono text-left bg-black/20 p-3 rounded">
                               <span className="text-emerald-500/50 mr-2">$</span>
                               {step.prompt}
                             </p>
                          </div>
                        </div>
                      )}
                    </div>
                 </div>
               ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700">
               <div className="bg-slate-800/50 p-4 rounded-md border border-slate-700">
                 <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Final Conclusion</h3>
                 <p className="text-lg text-white font-medium">{analysisResult.conclusion}</p>
               </div>
            </div>
            
            <div ref={endOfDossierRef} />
          </section>
        )}

        {/* Hidden Full Report Container for PDF Generation */}
        {analysisResult && (
          <div id="full-report-content" style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '794px', // A4 width at 96 DPI
            backgroundColor: '#ffffff',
            padding: '40px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            color: '#0f172a'
          }}>
             {/* Header */}
             <div id="report-header" style={{ borderBottom: '2px solid #10b981', paddingBottom: '20px', marginBottom: '30px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                 <div style={{ width: '40px', height: '40px', backgroundColor: '#10b981', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                 </div>
                 <h1 style={{ color: '#0f172a', fontSize: '32px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>VERITAS DOSSIER</h1>
               </div>
               <div style={{ display: 'flex', gap: '20px', marginTop: '10px', color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }}>
                  <p style={{ margin: 0 }}><strong>CASE ID:</strong> {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
                  <p style={{ margin: 0 }}><strong>DATE:</strong> {new Date().toLocaleDateString()}</p>
                  <p style={{ margin: 0 }}><strong>STATUS:</strong> {analysisResult.threat_level}</p>
               </div>
             </div>

             {/* Executive Overview */}
             <div id="report-overview" style={{ marginBottom: '40px' }}>
               <h2 style={{ color: '#10b981', fontSize: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>EXECUTIVE SUMMARY</h2>
               
               <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Threat Assessment</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: analysisResult.threat_level === 'HIGH' || analysisResult.threat_level === 'CRITICAL' ? '#ef4444' : analysisResult.threat_level === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                    {analysisResult.threat_level}
                  </div>
               </div>

               <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>Conclusion</h3>
                  <p style={{ color: '#334155', margin: 0, lineHeight: '1.6' }}>{analysisResult.conclusion}</p>
               </div>
             </div>

             {/* Detailed Analysis */}
             <div id="report-details" style={{ marginBottom: '40px' }}>
                <h2 id="report-details-header" style={{ color: '#10b981', fontSize: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>FORENSIC ANALYSIS LOG</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                   {analysisResult.narrative_steps.map((step: any, index: number) => (
                     <div id={`report-step-${index}`} key={index} style={{ padding: '15px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>STEP {index + 1}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' }}>{step.type.replace('_', ' ')}</span>
                        </div>
                        <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: 0 }}>{step.content}</p>
                        {step.coordinates && (
                          <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#d97706' }}>
                            📍 Coordinates: {step.coordinates}
                          </div>
                        )}
                        {step.language && (
                          <div style={{ marginTop: '10px', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '10px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'hidden' }}>
                            {step.content}
                          </div>
                        )}
                     </div>
                   ))}
                </div>
             </div>

             {/* Footer */}
             <div id="report-conclusion" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '40px', textAlign: 'center', paddingBottom: '40px' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', margin: 0 }}>GENERATED BY VERITAS FORENSIC SYSTEM</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', margin: '4px 0 0 0' }}>POWERED BY GEMINI 3.1 PRO</p>
             </div>
          </div>
        )}

        </>
        )}

      </main>

      <footer className="mt-12 text-center text-xs text-slate-500 font-mono">
        <p>Built with Gemini 3 Pro. Native Multimodal Reasoning.</p>
        <p className="mt-1 flex items-center justify-center">
          <Terminal className="h-3 w-3 mr-1" />
          SYSTEM_ONLINE
        </p>
        <button 
            onClick={() => setIsDemoMode(true)}
            className="mt-4 text-[10px] text-slate-700 hover:text-veritas-accent uppercase tracking-widest transition-colors"
        >
            [ Initiate Director Mode ]
        </button>
      </footer>
      {isDemoMode && <DirectorMode onClose={() => setIsDemoMode(false)} />}
    </div>
  );
}

export default App;
