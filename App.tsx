
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { analyzeText, transcribeAudio, generateSpeech, extractTextFromFile } from './services/geminiService';
import { AppStatus, AnalysisResponse, DetectedVoid } from './types';
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

// --- UI Components ---

const StatusIndicator: React.FC<{ status: AppStatus }> = ({ status }) => {
  let colorClass = 'text-gray-600';
  let label = status;

  if (status === AppStatus.ERROR) {
      colorClass = 'text-[#FF4B2B] bg-[#FF4B2B]/10 px-2';
      label = 'CRITICAL_ERROR';
  }
  if (status === AppStatus.ANALYZING) {
      colorClass = 'text-[#00E676] animate-pulse'; // Although animation disabled globally, keeping logic for semantics
      label = 'PROCESSING_LOGIC_GATES...';
  }
  if (status === AppStatus.TRANSCRIBING) {
      colorClass = 'text-[#00E676]';
      label = 'DECODING_AUDIO_STREAM...';
  }
  if (status === AppStatus.READING) {
      colorClass = 'text-[#00E676]';
      label = 'INGESTING_BINARY_DATA...';
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

const Header: React.FC = () => (
  <header className={`border-b border-[#222] p-4 flex justify-between items-center bg-[#050505] z-10`}>
    <div className="flex flex-col">
      <h1 className="text-xl font-bold tracking-tighter mono text-white leading-none">
        SOKRATISCHER_DEBUGGER_<span className="text-[#FF4B2B]">V1.0</span>
      </h1>
      <div className="flex items-center gap-2 mt-1 opacity-50">
        <span className="w-2 h-2 bg-[#00E676]"></span>
        <p className="text-[9px] uppercase tracking-[0.3em]">External_Frontal_Lobe_Interface</p>
      </div>
    </div>
    <div className="hidden md:block text-right">
       <div className="text-[9px] text-gray-600 uppercase tracking-widest">SYS_UPTIME: INFINITE</div>
       <div className="text-[9px] text-gray-600 uppercase tracking-widest">MEMORY: ALLOCATED</div>
    </div>
  </header>
);

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedVoid, setSelectedVoid] = useState<DetectedVoid | null>(null);
  const [useThinking, setUseThinking] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pauseOffsetRef = useRef(0);
  const startTimeRef = useRef(0);

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
        handleTranscription(base64);
      };

      recorder.start();
      setStatus(AppStatus.RECORDING);
    } catch (err) {
      console.error(err);
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

  const handleTranscription = async (base64: string) => {
    setStatus(AppStatus.TRANSCRIBING);
    try {
      const text = await transcribeAudio(base64);
      setInputText(text);
      if (text.trim()) {
        processAnalysis(text);
      } else {
        setStatus(AppStatus.IDLE);
      }
    } catch (err) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMessage("TRANSCRIPTION_FAILED");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(AppStatus.READING);
    setErrorMessage(null);
    setInputText("");

    try {
      const extractedText = await extractTextFromFile(file);
      setInputText(extractedText);
      setStatus(AppStatus.IDLE);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMessage("FILE_READ_FAILED");
    }
  };

  const processAnalysis = async (text: string) => {
    if (!text.trim()) return;
    setStatus(AppStatus.ANALYZING);
    setErrorMessage(null);
    setAnalysis(null);
    setSelectedVoid(null);
    stopAudio();
    setAudioBuffer(null);
    
    try {
      const result = await analyzeText(text, useThinking);
      setAnalysis(result);
      
      // Auto-TTS
      setStatus(AppStatus.SPEAKING);
      const speechBase64 = await generateSpeech(result.spiegel_intervention, selectedVoice);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const bytes = decode(speechBase64);
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
      
      setAudioBuffer(buffer);
      pauseOffsetRef.current = 0;
      playBuffer(buffer, 0);

    } catch (err) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMessage("ANALYSIS_FAILED");
    }
  };

  // --- Audio Playback ---
  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playBuffer = useCallback((buffer: AudioBuffer, offset: number) => {
    if (!audioContextRef.current) return;
    stopAudio();
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      setStatus(AppStatus.IDLE);
      pauseOffsetRef.current = 0;
    };
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime;
    sourceNodeRef.current = source;
    setIsPlaying(true);
  }, [stopAudio]);

  const togglePlayPause = () => {
    if (!audioBuffer) return;
    if (isPlaying) {
      if (sourceNodeRef.current && audioContextRef.current) {
        sourceNodeRef.current.onended = null;
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current = null;
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        pauseOffsetRef.current += elapsed;
        setIsPlaying(false);
      }
    } else {
      if (pauseOffsetRef.current >= audioBuffer.duration) pauseOffsetRef.current = 0;
      playBuffer(audioBuffer, pauseOffsetRef.current);
    }
  };

  const handleStopPlayback = () => {
    stopAudio();
    pauseOffsetRef.current = 0;
  };

  // --- Text Highlighting Logic ---
  const renderDebugView = useMemo(() => {
    if (!analysis) return null;
    if (!inputText) return null;

    // Map logic
    const voidMap = new Map<string, DetectedVoid>();
    analysis.detected_voids.forEach(v => {
      voidMap.set(v.word.toLowerCase(), v);
    });

    const parts = inputText.split(/(\s+|[.,;!?])/);

    return parts.map((part, index) => {
      const cleanPart = part.trim().toLowerCase().replace(/[.,;!?]/g, '');
      const detected = voidMap.get(cleanPart);
      
      if (detected) {
        const isSelected = selectedVoid?.word === detected.word;
        return (
          <span 
            key={index}
            onClick={() => setSelectedVoid(detected)}
            className={`cursor-pointer inline-block border-b-2 transition-colors duration-0
              ${isSelected 
                  ? 'bg-[#FF4B2B] text-black border-[#FF4B2B]' 
                  : 'text-[#FF4B2B] border-[#FF4B2B]/50 hover:bg-[#FF4B2B] hover:text-black'}
            `}
          >
            {part}
          </span>
        );
      }
      return <span key={index} className="text-gray-500">{part}</span>;
    });
  }, [inputText, analysis, selectedVoid]);


  return (
    <div className={`min-h-screen ${COLORS.BG} flex flex-col font-mono selection:bg-[#FF4B2B] selection:text-black cyber-grid`}>
      <Header />

      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-[1800px] mx-auto w-full gap-6 z-10">
        
        {/* 1. TEXT SCANNER (INPUT) */}
        <section className={`border-2 ${COLORS.BORDER_DIM} bg-[#050505] p-0 shadow-none`}>
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#222] bg-[#0a0a0a]">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">/// I/O_STREAM_INTERFACE</h2>
            <StatusIndicator status={status} />
          </div>
          
          <div className="flex flex-col">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="AWAITING_INPUT_STREAM... [TYPE OR PASTE DATA]"
              className={`w-full h-32 bg-[#050505] text-sm ${COLORS.TEXT_MAIN} p-4 focus:outline-none focus:bg-[#080808] resize-none placeholder:text-gray-800 rounded-none font-medium leading-relaxed`}
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 border-t border-[#333]">
              <button
                onClick={() => status === AppStatus.RECORDING ? stopRecording() : startRecording()}
                className={`h-12 text-[10px] uppercase tracking-wider font-bold rounded-none border-r border-b md:border-b-0 border-[#333]
                  ${status === AppStatus.RECORDING 
                    ? `${COLORS.BG_RED} text-black hover:bg-red-600` 
                    : `bg-[#050505] text-gray-400 hover:text-white hover:bg-[#111]`
                  }`}
              >
                {status === AppStatus.RECORDING ? '■ STOP_REC' : '● MIC_INPUT'}
              </button>

              <button
                 onClick={() => fileInputRef.current?.click()}
                 className={`h-12 bg-[#050505] text-gray-400 hover:text-white hover:bg-[#111] text-[10px] uppercase tracking-wider font-bold border-r border-b md:border-b-0 border-[#333] rounded-none`}
              >
                ▲ LOAD_FILE
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.pdf" className="hidden" />

              <div className="flex items-center justify-center px-4 bg-[#050505] border-r border-b md:border-b-0 border-[#333] h-12">
                 <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-[#050505] text-[#00E676] text-[10px] uppercase outline-none cursor-pointer w-full font-bold border-none text-center"
                  >
                    {VOICES.map(v => <option key={v.value} value={v.value}>{v.name}</option>)}
                  </select>
              </div>

              <label className="flex items-center justify-center gap-2 px-4 bg-[#050505] border-r border-b md:border-b-0 border-[#333] h-12 cursor-pointer hover:bg-[#111]">
                 <input 
                    type="checkbox" 
                    checked={useThinking} 
                    onChange={(e) => setUseThinking(e.target.checked)}
                    className="accent-[#00E676] h-3 w-3 rounded-none bg-black border border-gray-600 appearance-none checked:bg-[#00E676]" 
                 />
                 <span className="text-[10px] uppercase text-gray-400 font-bold">DEEP_THINK</span>
              </label>

              <button
                onClick={() => processAnalysis(inputText)}
                disabled={status !== AppStatus.IDLE || !inputText.trim()}
                className={`col-span-2 md:col-span-4 lg:col-span-1 h-12 text-[10px] uppercase tracking-[0.2em] font-bold rounded-none
                  ${status !== AppStatus.IDLE || !inputText.trim() 
                    ? 'bg-[#111] text-gray-700 cursor-not-allowed' 
                    : `${COLORS.BG_GREEN} text-black hover:bg-[#00ff88] border-l border-[#333]`
                  }`}
              >
                ► RUN_DIAGNOSTIC
              </button>
            </div>
            
            {errorMessage && (
              <div className={`p-3 border-t ${COLORS.BORDER_RED} bg-[#FF4B2B] text-black text-xs uppercase font-bold`}>
                !!! CRITICAL_FAILURE: {errorMessage}
              </div>
            )}
          </div>
        </section>

        {/* 2. DEBUG VIEW & LOGIC CARDS */}
        {analysis && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[500px]">
            
            {/* DEBUG VIEW */}
            <section className={`flex-[2] border-2 ${COLORS.BORDER_DIM} bg-[#050505] p-0 flex flex-col rounded-none`}>
              <div className="bg-[#0a0a0a] px-4 py-2 border-b border-[#222] flex justify-between items-center">
                 <h2 className={`text-[10px] uppercase tracking-[0.2em] ${COLORS.ACCENT_RED} font-bold`}>/// VOID_DETECTION_MATRIX</h2>
                 <span className="text-[9px] text-black bg-[#FF4B2B] px-1 font-bold">SCAN_COMPLETE</span>
              </div>
              <div className="p-8 text-base leading-loose font-light tracking-wide overflow-y-auto flex-1 font-mono text-gray-400">
                {renderDebugView}
              </div>
            </section>

            {/* LOGIC CARD */}
            <section className={`flex-1 border-2 ${COLORS.BORDER_DIM} bg-[#080808] flex flex-col rounded-none`}>
               <div className="bg-[#0a0a0a] px-4 py-2 border-b border-[#222]">
                 <h2 className={`text-[10px] uppercase tracking-[0.2em] ${COLORS.ACCENT_GREEN} font-bold`}>/// LOGIC_INSPECTOR</h2>
              </div>
              
              <div className="p-6 flex-1 flex flex-col relative overflow-hidden">
                {selectedVoid ? (
                  <div className="flex flex-col gap-6 h-full z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1 h-1 bg-[#FF4B2B]"></span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">TARGET_NOMINAL</span>
                      </div>
                      <h3 className={`text-4xl font-bold ${COLORS.ACCENT_RED} uppercase border-b border-[#333] pb-4 break-words`}>
                        {selectedVoid.word}
                      </h3>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1 h-1 bg-[#FF4B2B]"></span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">DETECTED_GAP</span>
                      </div>
                      <p className="text-sm text-black font-bold bg-[#FF4B2B] p-2">
                        {selectedVoid.logic_gap}
                      </p>
                    </div>

                    <div className="space-y-4 mt-auto">
                      <div className="p-4 border border-[#333] bg-[#050505]">
                        <span className={`text-[9px] ${COLORS.ACCENT_GREEN} block mb-2 font-bold uppercase`}>[L] Localization</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">{selectedVoid.socratic_questions.L}</p>
                      </div>
                      <div className="p-4 border border-[#333] bg-[#050505]">
                         <span className={`text-[9px] ${COLORS.ACCENT_GREEN} block mb-2 font-bold uppercase`}>[M] Mechanics</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">{selectedVoid.socratic_questions.M}</p>
                      </div>
                      <div className="p-4 border border-[#333] bg-[#050505]">
                         <span className={`text-[9px] ${COLORS.ACCENT_GREEN} block mb-2 font-bold uppercase`}>[V] Validation</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">{selectedVoid.socratic_questions.V}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#222]">
                    <div className="w-24 h-24 border-2 border-[#111] flex items-center justify-center mb-4 bg-transparent relative">
                        <div className="absolute inset-0 border border-[#111] scale-75"></div>
                        <span className="text-2xl font-bold text-[#222]">NULL</span>
                    </div>
                    <p className="text-xs uppercase tracking-widest text-center font-bold text-[#333]">Awaiting_Selection</p>
                    <p className="text-[9px] mt-2 font-mono text-[#222]">SELECT_RED_MARKERS_TO_INSPECT</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* 3. INTERVENTION ZONE */}
        {analysis && (
          <section className={`border-2 ${COLORS.BORDER_GREEN} bg-[#001a0d] p-8 mt-auto rounded-none relative overflow-hidden`}>
            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'linear-gradient(#00E676 1px, transparent 1px), linear-gradient(90deg, #00E676 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
            
            <div className="flex justify-between items-end mb-6 border-b border-[#00E676]/30 pb-4 relative z-10">
               <h2 className={`text-[10px] uppercase tracking-[0.3em] ${COLORS.ACCENT_GREEN} font-bold`}>/// SPIEGEL_INTERVENTION_MODULE</h2>
               {audioBuffer && (
                <div className="flex gap-2">
                   <button 
                      onClick={togglePlayPause}
                      className={`px-4 py-2 border ${COLORS.BORDER_GREEN} ${COLORS.ACCENT_GREEN} hover:bg-[#00E676] hover:text-black uppercase text-[10px] font-bold tracking-wider rounded-none min-w-[120px] transition-none`}
                    >
                      {isPlaying ? '■ HALT_AUDIO' : '▶ PLAY_AUDIO'}
                   </button>
                </div>
              )}
            </div>
            
            <p className="text-xl md:text-3xl font-light leading-snug text-[#e5e5e5] font-mono relative z-10">
              "{analysis.spiegel_intervention}"
            </p>
          </section>
        )}
      </main>

      <footer className="p-2 border-t border-[#222] bg-[#050505] flex justify-between items-center text-[9px] text-[#444] uppercase font-bold tracking-widest px-6">
        <div>System_Ready</div>
        <div>Pure_Logic_Protocol_V1.0</div>
      </footer>
    </div>
  );
};

export default App;
