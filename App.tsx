
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { sendMessageToChat, transcribeAudio, generateSpeech, extractTextFromFile, resetChat, initChatSession } from './services/geminiService';
import { AppStatus, AnalysisResponse, DetectedVoid, ChatMessage, SystemConfig, CognitiveLoad, SystemLanguage } from './types';
import { decode, decodeAudioData, blobToBase64 } from './utils/audioUtils';

// --- Constants ---
const COLORS = {
  BG: 'bg-[#050505]',
  TEXT_MAIN: 'text-white',
  ACCENT_RED: 'text-[#FF4B2B]',
  BG_RED: 'bg-[#FF4B2B]',
  BORDER_RED: 'border-[#FF4B2B]',
  ACCENT_GREEN: 'text-[#00E676]',
  BG_GREEN: 'bg-[#00E676]',
  BORDER_GREEN: 'border-[#00E676]',
  BORDER_DIM: 'border-[#333333]',
  BG_DIM: 'bg-[#111]',
};

const VOICES = [
  { name: 'Kore (Fest)', value: 'Kore' },
  { name: 'Puck (Upbeat)', value: 'Puck' },
  { name: 'Charon (Informativ)', value: 'Charon' },
  { name: 'Fenrir (Leicht aufgeregt)', value: 'Fenrir' },
  { name: 'Zephyr (Hell)', value: 'Zephyr' },
  { name: 'Leda (Jugendlich)', value: 'Leda' },
  { name: 'Orus (Fest)', value: 'Orus' },
  { name: 'Aoede (Breezy)', value: 'Aoede' },
  { name: 'Callirrhoe (Gelassen)', value: 'Callirrhoe' },
  { name: 'Autonoe (Hell)', value: 'Autonoe' },
  { name: 'Enceladus (Breathy)', value: 'Enceladus' },
  { name: 'Iapetus (Clear)', value: 'Iapetus' },
  { name: 'Umbriel (Gelassen)', value: 'Umbriel' },
  { name: 'Algieba (Smooth)', value: 'Algieba' },
  { name: 'Despina (Weich)', value: 'Despina' },
  { name: 'Erinome (Wolkenlos)', value: 'Erinome' },
  { name: 'Algenib (Gravelly)', value: 'Algenib' },
  { name: 'Rasalgethi (Informativ)', value: 'Rasalgethi' },
  { name: 'Laomedeia (Upbeat)', value: 'Laomedeia' },
  { name: 'Achernar (Weich)', value: 'Achernar' },
  { name: 'Alnilam (Firm)', value: 'Alnilam' },
  { name: 'Schedar (Gerade)', value: 'Schedar' },
  { name: 'Gacrux (Nicht jugendfrei)', value: 'Gacrux' },
  { name: 'Pulcherrima (Vorwärts)', value: 'Pulcherrima' },
  { name: 'Achird (Freundlich)', value: 'Achird' },
  { name: 'Zubenelgenubi (Casual)', value: 'Zubenelgenubi' },
  { name: 'Vindemiatrix (Sanft)', value: 'Vindemiatrix' },
  { name: 'Sadachbia (Lively)', value: 'Sadachbia' },
  { name: 'Sadaltager (Sachkundig)', value: 'Sadaltager' },
  { name: 'Sulafat (Warm)', value: 'Sulafat' }
];

// --- Boot/Config Screen ---

const ConfigScreen: React.FC<{ onStart: (config: SystemConfig) => void }> = ({ onStart }) => {
  const [load, setLoad] = useState<CognitiveLoad>(CognitiveLoad.BALANCED);
  const [lang, setLang] = useState<SystemLanguage>(SystemLanguage.GERMAN);

  const loadOptions = [
    { 
      id: CognitiveLoad.SIMPLIFIED, 
      label: 'SIMPLIFIED', 
      desc: 'Reduces semantic complexity. Explains logic gaps gently. Suitable for beginners.',
      color: 'border-blue-500 text-blue-500'
    },
    { 
      id: CognitiveLoad.BALANCED, 
      label: 'BALANCED', 
      desc: 'Standard conversational parameters. Balances precision with readability.',
      color: 'border-[#00E676] text-[#00E676]'
    },
    { 
      id: CognitiveLoad.ACADEMIC, 
      label: 'ACADEMIC', 
      desc: 'High-density terminology. Expects rigorous intellectual standards.',
      color: 'border-purple-500 text-purple-500'
    },
    { 
      id: CognitiveLoad.RUTHLESS, 
      label: 'RUTHLESS', 
      desc: 'WARNING: Safety protocols disabled. Radical deconstruction. No mercy.',
      color: 'border-[#FF4B2B] text-[#FF4B2B]'
    },
  ];

  return (
    <div className={`fixed inset-0 z-50 ${COLORS.BG} flex flex-col items-center justify-center font-mono p-4`}>
       <div className="max-w-2xl w-full border-2 border-[#333] p-1 bg-[#050505] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <div className="bg-[#0a0a0a] border border-[#222] p-8 md:p-12 flex flex-col gap-8 relative overflow-hidden">
             
             {/* Header */}
             <div className="text-center space-y-2 relative z-10">
                <div className="inline-block border border-[#333] px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-2">System_Boot_Sequence</div>
                <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-white">
                  SOKRATISCHER<br/><span className={COLORS.ACCENT_RED}>DEBUGGER_V2.0</span>
                </h1>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-4">Select Logic Core Parameters</p>
             </div>

             {/* Language Select */}
             <div className="grid grid-cols-2 gap-4">
                {[SystemLanguage.GERMAN, SystemLanguage.ENGLISH].map((l) => (
                   <button
                     key={l}
                     onClick={() => setLang(l)}
                     className={`h-12 border ${lang === l ? COLORS.BORDER_GREEN + ' bg-[#00E676]/10 text-[#00E676]' : 'border-[#333] text-gray-500 hover:border-gray-500'} font-bold uppercase tracking-widest transition-none`}
                   >
                     {l === 'DE' ? 'Deutsch' : 'English'}
                   </button>
                ))}
             </div>

             {/* Load Select */}
             <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-[#222] pb-2">Cognitive Density Level</p>
                <div className="grid grid-cols-1 gap-3">
                   {loadOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setLoad(opt.id)}
                        className={`group text-left p-4 border transition-none relative overflow-hidden
                           ${load === opt.id ? `${opt.color} bg-white/5` : 'border-[#222] text-gray-500 hover:border-gray-600'}
                        `}
                      >
                         <div className="flex justify-between items-center relative z-10">
                            <span className="font-bold text-sm tracking-widest">{opt.label}</span>
                            {load === opt.id && <span className="text-[10px] font-bold">/// ACTIVE</span>}
                         </div>
                         <p className={`text-xs mt-2 opacity-70 ${load === opt.id ? 'text-gray-300' : 'text-gray-600'}`}>
                           {opt.desc}
                         </p>
                      </button>
                   ))}
                </div>
             </div>

             {/* Start Button */}
             <button
               onClick={() => onStart({ load, language: lang })}
               className={`h-16 mt-4 border-2 ${COLORS.BORDER_GREEN} ${COLORS.BG_GREEN} text-black font-bold text-lg uppercase tracking-[0.2em] hover:bg-white transition-none shadow-[0_0_20px_rgba(0,230,118,0.2)]`}
             >
               Initialize_System
             </button>

             {/* Decor */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#333] to-transparent opacity-50"></div>
             <div className="absolute bottom-0 right-0 p-4 text-[9px] text-[#333] font-bold">V.2.0.4.BUILD.99</div>
          </div>
       </div>
    </div>
  );
};


// --- Main Application ---

const StatusIndicator: React.FC<{ status: AppStatus }> = ({ status }) => {
  let colorClass = 'text-gray-600';
  let label = status;

  if (status === AppStatus.ERROR) {
      colorClass = 'text-[#FF4B2B] bg-[#FF4B2B]/10 px-2';
      label = 'CRITICAL_ERROR';
  }
  if (status === AppStatus.ANALYZING) {
      colorClass = 'text-[#00E676] animate-pulse';
      label = 'COMPUTING_LOGIC_VECTOR...';
  }
  if (status === AppStatus.TRANSCRIBING) {
      colorClass = 'text-[#00E676]';
      label = 'DECODING_AUDIO_STREAM...';
  }
  if (status === AppStatus.RECORDING) {
      colorClass = 'text-[#FF4B2B] bg-[#FF4B2B]/10 px-2';
      label = '● RECORDING_INPUT';
  }
  if (status === AppStatus.SPEAKING) {
      colorClass = 'text-[#00E676]';
      label = 'AUDIO_OUTPUT_ACTIVE';
  }

  return (
    <div className={`mono text-[10px] font-bold uppercase tracking-widest ${colorClass}`}>
      STATUS: {label}
    </div>
  );
};

const Header: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className={`border-b border-[#222] p-4 flex justify-between items-center bg-[#050505] z-10 h-16`}>
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tighter mono text-white leading-none">
          SOKRATISCHER_DEBUGGER_<span className="text-[#FF4B2B]">V2.0</span>
        </h1>
        <div className="flex items-center gap-2 mt-1 opacity-50">
          <span className="w-2 h-2 bg-[#00E676]"></span>
          <p className="text-[9px] uppercase tracking-[0.3em]">External_Frontal_Lobe_Interface</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
         <button
            onClick={onReset}
            className="border border-[#333] px-3 py-2 text-[9px] font-bold text-[#444] hover:text-[#00E676] hover:border-[#00E676] uppercase tracking-wider transition-none rounded-none"
         >
           REBOOT
         </button>
         <button 
           onClick={toggleFullScreen}
           className="border border-[#333] p-2 hover:bg-[#111] hover:border-[#FF4B2B] text-[#444] hover:text-[#FF4B2B] transition-none rounded-none"
           title="TOGGLE_FULLSCREEN"
         >
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
           </svg>
         </button>
      </div>
    </header>
  );
};

export const App: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [selectedVoid, setSelectedVoid] = useState<DetectedVoid | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Core Logic ---

  const handleSystemStart = (newConfig: SystemConfig) => {
    initChatSession(newConfig);
    setConfig(newConfig);
  };

  const handleReset = () => {
    resetChat();
    setConfig(null); // Go back to config screen
    setMessages([]);
    setActiveMessageId(null);
    setSelectedVoid(null);
    setAudioBuffer(null);
    setInputText("");
    setStatus(AppStatus.IDLE);
    stopAudio();
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setStatus(AppStatus.ANALYZING);
    setErrorMessage(null);
    stopAudio();

    try {
      // 2. Get AI Response
      const result = await sendMessageToChat(text);
      
      const sysMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        text: result.spiegel_intervention,
        timestamp: Date.now(),
        analysis: result
      };

      setMessages(prev => [...prev, sysMsg]);
      setActiveMessageId(sysMsg.id); // Auto-select latest system message
      setSelectedVoid(null); // Reset void selection
      
      // 3. TTS
      setStatus(AppStatus.SPEAKING);
      const speechBase64 = await generateSpeech(result.spiegel_intervention, selectedVoice);
      playAudio(speechBase64);

    } catch (err) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMessage("LOGIC_CORE_FAILURE");
    }
  };

  // --- Audio / File Handlers ---

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64 = await blobToBase64(audioBlob);
        setStatus(AppStatus.TRANSCRIBING);
        try {
          const text = await transcribeAudio(base64);
          if (text.trim()) handleSend(text);
          else setStatus(AppStatus.IDLE);
        } catch (e) {
            setStatus(AppStatus.ERROR);
        }
      };

      recorder.start();
      setStatus(AppStatus.RECORDING);
    } catch (err) {
      setStatus(AppStatus.ERROR);
      setErrorMessage("MIC_ACCESS_DENIED");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(AppStatus.READING);
    try {
      const extractedText = await extractTextFromFile(file);
      if (extractedText.trim()) handleSend(extractedText);
      else setStatus(AppStatus.IDLE);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setStatus(AppStatus.ERROR);
      setErrorMessage("FILE_READ_FAILED");
    }
  };

  // --- Audio Playback Logic ---
  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    const bytes = decode(base64);
    const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
    setAudioBuffer(buffer);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => { setIsPlaying(false); setStatus(AppStatus.IDLE); };
    source.start(0);
    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setStatus(AppStatus.IDLE);
  }, []);

  const togglePlayPause = () => {
    if (isPlaying) stopAudio();
    // Resume logic omitted for brevity in chat mode, usually simple restart or complex offset tracking
  };

  // --- Export Logic ---
  const handleExportAnalysis = () => {
    if (!activeAnalysis) return;
    
    // Create a Blob containing the JSON data
    const jsonString = JSON.stringify(activeAnalysis, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = `sokratischer_analysis_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Derived State ---
  const activeMessage = useMemo(() => 
    messages.find(m => m.id === activeMessageId) || null, 
  [messages, activeMessageId]);

  const activeAnalysis = activeMessage?.role === 'system' ? activeMessage.analysis : null;
  
  const renderActiveAnalysisText = useMemo(() => {
    if (!activeAnalysis) return null;
    
    const interventionText = activeAnalysis.spiegel_intervention;
    const voidMap = new Map<string, DetectedVoid>();
    activeAnalysis.detected_voids.forEach(v => voidMap.set(v.word.toLowerCase(), v));

    // Improved tokenizer that preserves delimiters
    // Splits by whitespace, punctuation, brackets, slashes, dashes etc, but keeps them in the array
    const parts = interventionText.split(/([\s.,;!?:"'()\[\]{}<>\-\/]+)/);
    
    return (
        <div className="font-mono text-lg leading-relaxed text-gray-300">
             {parts.map((part, index) => {
                // Normalization for matching
                const cleanPart = part.trim().toLowerCase();
                if (!cleanPart) return <span key={index}>{part}</span>;

                const detected = voidMap.get(cleanPart);
                
                if (detected) {
                    const isSelected = selectedVoid?.word === detected.word;
                    return (
                        <span 
                            key={index}
                            onClick={() => setSelectedVoid(detected)}
                            className={`
                              cursor-pointer transition-all duration-150 relative inline-block mx-0.5 px-1 rounded-sm
                              ${isSelected 
                                ? 'bg-[#FF4B2B] text-black font-bold shadow-[0_0_10px_rgba(255,75,43,0.5)] transform scale-105 z-10' 
                                : 'text-[#FF4B2B] border-b border-dashed border-[#FF4B2B] hover:bg-[#FF4B2B]/20 hover:border-solid'
                              }
                            `}
                        >
                            {part}
                        </span>
                    );
                }
                return <span key={index}>{part}</span>;
             })}
        </div>
    );
  }, [activeAnalysis, selectedVoid]);


  // --- Render ---

  if (!config) {
    return <ConfigScreen onStart={handleSystemStart} />;
  }

  return (
    <div className={`h-screen max-h-screen ${COLORS.BG} flex flex-col font-mono selection:bg-[#FF4B2B] selection:text-black cyber-grid overflow-hidden`}>
      <Header onReset={handleReset} />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1920px] mx-auto w-full border-t border-[#222]">
        
        {/* === LEFT COLUMN: CHAT TERMINAL === */}
        <section className={`flex-1 flex flex-col border-r border-[#222] min-w-[300px] lg:max-w-[50%]`}>
          
          {/* LOG AREA */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
             {messages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-gray-800 opacity-50">
                     <div className="w-16 h-16 border border-gray-800 flex items-center justify-center mb-4">
                         <div className="w-8 h-8 bg-gray-900"></div>
                     </div>
                     <p className="text-xs uppercase tracking-widest">AWAITING_INITIAL_INPUT</p>
                 </div>
             )}
             
             {messages.map((msg) => (
               <div 
                 key={msg.id} 
                 onClick={() => msg.role === 'system' && setActiveMessageId(msg.id)}
                 className={`flex flex-col gap-1 group ${msg.role === 'system' ? 'cursor-pointer' : ''}`}
               >
                 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 font-bold">
                    <span className={msg.role === 'user' ? 'text-white' : 'text-[#00E676]'}>
                        {msg.role === 'user' ? '> [USER_INPUT]' : '> [CORE_RESPONSE]'}
                    </span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {msg.id === activeMessageId && <span className="bg-[#00E676] text-black px-1 ml-2">ACTIVE_VIEW</span>}
                 </div>
                 
                 <div className={`p-3 border-l-2 ${msg.role === 'user' ? 'border-[#333] text-gray-400 pl-4' : 'border-[#00E676] bg-[#001a0d]/30 text-[#e5e5e5] hover:bg-[#001a0d]/50'}`}>
                    {msg.text}
                 </div>
               </div>
             ))}
             <div ref={messagesEndRef} />
          </div>

          {/* INPUT AREA */}
          <div className="border-t border-[#333] bg-[#050505] p-0">
             <div className="flex items-center border-b border-[#333] bg-[#080808] px-2 h-8">
                 <StatusIndicator status={status} />
                 {errorMessage && <span className="ml-4 text-[#FF4B2B] text-[10px] font-bold">ERROR: {errorMessage}</span>}
             </div>
             
             <div className="flex">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(inputText);
                      }
                  }}
                  disabled={status === AppStatus.ANALYZING}
                  placeholder="ENTER_DATA_STREAM..."
                  className={`flex-1 h-20 bg-[#050505] text-sm ${COLORS.TEXT_MAIN} p-4 focus:outline-none resize-none placeholder:text-gray-800 leading-relaxed rounded-none`}
                />
                
                <div className="flex flex-col w-32 border-l border-[#333]">
                    <button
                        onClick={() => status === AppStatus.RECORDING ? stopRecording() : startRecording()}
                        className={`flex-1 flex items-center justify-center text-[10px] font-bold uppercase transition-colors
                            ${status === AppStatus.RECORDING ? 'bg-[#FF4B2B] text-black' : 'bg-[#080808] text-gray-500 hover:text-white hover:bg-[#111]'}
                        `}
                    >
                        {status === AppStatus.RECORDING ? 'STOP' : 'MIC'}
                    </button>
                    <button
                        onClick={() => handleSend(inputText)}
                        disabled={!inputText.trim() || status === AppStatus.ANALYZING}
                        className={`flex-1 border-t border-[#333] flex items-center justify-center text-[10px] font-bold uppercase
                            ${!inputText.trim() ? 'bg-[#050505] text-gray-800' : 'bg-[#00E676] text-black hover:bg-[#00ff88]'}
                        `}
                    >
                        SEND
                    </button>
                </div>
             </div>
             
             {/* Additional Controls */}
             <div className="flex border-t border-[#333]">
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.pdf" className="hidden" />
                 <button onClick={() => fileInputRef.current?.click()} className="flex-1 h-10 border-r border-[#333] hover:bg-[#111] text-gray-500 text-[10px] font-bold uppercase">UPLOAD_FILE</button>
                 <select 
                    value={selectedVoice} 
                    onChange={e => setSelectedVoice(e.target.value)} 
                    className="flex-1 h-10 bg-[#050505] text-gray-500 text-[10px] font-bold uppercase text-center outline-none border-none hover:bg-[#111]"
                 >
                     {VOICES.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}
                 </select>
             </div>
          </div>
        </section>


        {/* === RIGHT COLUMN: LOGIC CORE === */}
        <section className={`flex-[1.2] flex flex-col bg-[#050505] relative overflow-hidden`}>
           {/* Header */}
           <div className="h-8 bg-[#0a0a0a] border-b border-[#222] flex justify-between items-center px-4">
                <h2 className={`text-[10px] uppercase tracking-[0.2em] ${COLORS.ACCENT_GREEN} font-bold`}>/// ANALYSIS_CORE</h2>
                <div className="flex items-center gap-2">
                    {activeAnalysis && (
                        <>
                             <button
                                onClick={handleExportAnalysis}
                                className="text-[9px] border border-[#333] hover:border-[#00E676] text-gray-500 hover:text-[#00E676] px-2 py-0.5 uppercase font-bold transition-none"
                             >
                                Export_JSON
                             </button>
                             <span className="text-[9px] bg-[#00E676] text-black px-1 font-bold">DATA_LOADED</span>
                        </>
                    )}
                </div>
           </div>

           {activeAnalysis ? (
               <div className="flex-1 flex flex-col h-full overflow-hidden">
                   
                    {/* Quick Select Chips */}
                    <div className="bg-[#080808] border-b border-[#222] p-2 flex flex-wrap gap-2 min-h-[40px] items-center">
                        <span className="text-[9px] uppercase text-gray-600 mr-2 tracking-widest">DETECTED:</span>
                        {activeAnalysis.detected_voids.map((voidItem, idx) => (
                             <button
                                key={idx}
                                onClick={() => setSelectedVoid(voidItem)}
                                className={`text-[10px] px-2 py-1 uppercase tracking-wider font-bold border transition-all
                                   ${selectedVoid?.word === voidItem.word 
                                      ? 'bg-[#FF4B2B] text-black border-[#FF4B2B]' 
                                      : 'bg-transparent text-[#FF4B2B] border-[#FF4B2B]/30 hover:border-[#FF4B2B] hover:bg-[#FF4B2B]/10'
                                   }
                                `}
                             >
                                {voidItem.word}
                             </button>
                        ))}
                    </div>

                   {/* Top: Visualization of Text (with highlighting) */}
                   <div className="flex-1 p-8 overflow-y-auto border-b border-[#222]">
                        <p className="text-[10px] uppercase text-gray-600 mb-4 tracking-widest">SYSTEM_INTERVENTION_LAYER</p>
                        {renderActiveAnalysisText}
                   </div>

                   {/* Bottom: The Void Card */}
                   <div className="h-[45%] bg-[#080808] flex flex-col border-t border-[#222]">
                      <div className="h-8 bg-[#0a0a0a] border-b border-[#222] flex items-center px-4">
                         <h2 className={`text-[10px] uppercase tracking-[0.2em] ${COLORS.ACCENT_RED} font-bold`}>/// LOGIC_INSPECTOR</h2>
                      </div>

                      <div className="flex-1 p-6 overflow-y-auto">
                        {selectedVoid ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                                <div className="flex flex-col gap-4">
                                     <div>
                                        <span className="text-[9px] text-[#FF4B2B] uppercase tracking-widest block mb-1">TARGET</span>
                                        <h3 className="text-3xl font-bold text-white border-b border-[#333] pb-2">{selectedVoid.word}</h3>
                                     </div>
                                     <div>
                                        <span className="text-[9px] text-[#FF4B2B] uppercase tracking-widest block mb-1">LOGIC_GAP</span>
                                        <div className="bg-[#FF4B2B]/10 text-[#FF4B2B] p-3 text-sm font-bold border-l-2 border-[#FF4B2B]">{selectedVoid.logic_gap}</div>
                                     </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="bg-[#111] p-3 border border-[#222]">
                                        <span className="text-[9px] text-[#00E676] uppercase font-bold block mb-1">[L] LOCALIZATION</span>
                                        <p className="text-xs text-gray-400">{selectedVoid.socratic_questions.L}</p>
                                    </div>
                                    <div className="bg-[#111] p-3 border border-[#222]">
                                        <span className="text-[9px] text-[#00E676] uppercase font-bold block mb-1">[M] MECHANICS</span>
                                        <p className="text-xs text-gray-400">{selectedVoid.socratic_questions.M}</p>
                                    </div>
                                    <div className="bg-[#111] p-3 border border-[#222]">
                                        <span className="text-[9px] text-[#00E676] uppercase font-bold block mb-1">[V] VALIDATION</span>
                                        <p className="text-xs text-gray-400">{selectedVoid.socratic_questions.V}</p>
                                    </div>
                                </div>
                           </div>
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center text-[#222]">
                                <div className="w-12 h-12 border-2 border-[#222] flex items-center justify-center mb-2">
                                    <div className="w-2 h-2 bg-[#222]"></div>
                                </div>
                                <p className="text-[10px] uppercase tracking-widest text-[#333]">SELECT_HIGHLIGHTED_TERMS</p>
                           </div>
                        )}
                      </div>
                   </div>
               </div>
           ) : (
               <div className="h-full flex flex-col items-center justify-center text-gray-800">
                    <div className="text-6xl mb-4 font-thin opacity-10">///</div>
                    <p className="text-xs uppercase tracking-[0.2em] opacity-50">NO_DATA_STREAM_SELECTED</p>
               </div>
           )}

            {/* Audio Control Overlay (Bottom Right) */}
            {isPlaying && (
                <div className="absolute bottom-4 right-4 z-20">
                     <button 
                        onClick={stopAudio}
                        className={`bg-[#00E676] text-black px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white`}
                     >
                        ■ STOP_AUDIO_FEED
                     </button>
                </div>
            )}
        </section>

      </main>

      <footer className="h-6 border-t border-[#222] bg-[#050505] flex justify-between items-center text-[9px] text-[#333] uppercase font-bold tracking-widest px-4 shrink-0">
        <div>System_Ready</div>
        <div>Pure_Logic_Protocol_V2.0</div>
      </footer>
    </div>
  );
};
