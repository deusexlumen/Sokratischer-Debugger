
export interface SocraticQuestion {
  L: string;
  M: string;
  V: string;
}

export interface DetectedVoid {
  word: string;
  logic_gap: string;
  socratic_questions: SocraticQuestion;
}

export interface AnalysisResponse {
  detected_voids: DetectedVoid[];
  spiegel_intervention: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  text: string;
  timestamp: number;
  analysis?: AnalysisResponse; // Only system messages have analysis data
}

export enum AppStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  TRANSCRIBING = 'TRANSCRIBING',
  READING = 'READING_FILE',
  ANALYZING = 'ANALYZING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export enum CognitiveLoad {
  SIMPLIFIED = 'SIMPLIFIED',   // Easy to understand, gentle
  BALANCED = 'BALANCED',       // Standard conversational
  ACADEMIC = 'ACADEMIC',       // High precision, scientific
  RUTHLESS = 'RUTHLESS'        // The original "God Mode"
}

export enum SystemLanguage {
  GERMAN = 'DE',
  ENGLISH = 'EN'
}

export interface SystemConfig {
  load: CognitiveLoad;
  language: SystemLanguage;
}
