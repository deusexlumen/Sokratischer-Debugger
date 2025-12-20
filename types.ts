
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

export enum AppStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  TRANSCRIBING = 'TRANSCRIBING',
  READING = 'READING_FILE',
  ANALYZING = 'ANALYZING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}
