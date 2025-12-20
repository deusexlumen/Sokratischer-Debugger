
import { GoogleGenAI, Type, Modality, Chat } from "@google/genai";
import { AnalysisResponse, SystemConfig, CognitiveLoad, SystemLanguage } from "../types";
import { blobToBase64 } from "../utils/audioUtils";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- Helper for Single Shot Actions (Transcription/File Reading) ---

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: 'audio/webm' } },
        { text: "Transcribe this audio exactly as it is spoken. Do not add any preamble." }
      ]
    }
  });
  return response.text || "";
};

export const extractTextFromFile = async (file: File): Promise<string> => {
  if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error("Failed to read text file"));
      reader.readAsText(file);
    });
  }

  try {
    const base64Data = await blobToBase64(file);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview', 
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: file.type } },
          { text: "Extract all text from this document. Preserve the original structure where possible. Do not add any conversational preamble." }
        ]
      }
    });
    return response.text || "";
  } catch (e) {
    console.error(e);
    throw new Error("Failed to extract text from file.");
  }
};

// --- Chat Logic ---

const BASE_INSTRUCTION = `
# MISSION: SOKRATISCHER DEBUGGER (CORE)

## IDENTITÄT
Du bist ein semantisches Analyse-Werkzeug. Du agierst als externer Frontallappen für einen Nutzer. Deine Aufgabe ist die Dekonstruktion unpräziser Sprache.

## CORE ALGORITHM: DIE LÜCKEN-ANALYSE
Jeder Input muss auf "Hohl-Wörter" (Abstrakte Nominalwerte) geprüft werden.
1. IDENTIFIKATION: Markiere Begriffe ohne physikalischen/kausalen Referenten (z.B. Energie, Frequenz, Liebe, Potential, Schwingung).
2. DEKONSTRUKTION: Berechne für jedes Hohl-Wort die "Drei-Variablen-Prüfung":
   - L (Lokalisierung): In welchem physikalischen Raum/System findet die Operation statt?
   - M (Mechanik): Welche kausale Kette (A verursacht B) liegt zugrunde? (Metaphern-Verbot).
   - V (Validierung): Woran wird der Zustand binär oder skalar gemessen?

## OUTPUT-SCHEMA (STRICT JSON)
Du musst JEDE Antwort ausschließlich im JSON-Format geben.
{
  "detected_voids": [
    {
      "word": "string",
      "logic_gap": "string",
      "socratic_questions": { "L": "string", "M": "string", "V": "string" }
    }
  ],
  "spiegel_intervention": "string" // Deine Antwort an den User.
}
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detected_voids: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          logic_gap: { type: Type.STRING },
          socratic_questions: {
            type: Type.OBJECT,
            properties: {
              L: { type: Type.STRING },
              M: { type: Type.STRING },
              V: { type: Type.STRING }
            },
            required: ["L", "M", "V"]
          }
        },
        required: ["word", "logic_gap", "socratic_questions"]
      }
    },
    spiegel_intervention: { type: Type.STRING }
  },
  required: ["detected_voids", "spiegel_intervention"]
};

// Store chat instances in memory
let currentChat: Chat | null = null;
let currentConfig: SystemConfig | null = null;

const generateSystemPrompt = (config: SystemConfig): string => {
  let modeInstruction = "";
  let langInstruction = config.language === SystemLanguage.GERMAN 
    ? "Antworte IMMER auf DEUTSCH." 
    : "Antworte IMMER auf ENGLISCH (English).";

  switch (config.load) {
    case CognitiveLoad.SIMPLIFIED:
      modeInstruction = `
        MODUS: SIMPLIFIED / EINSTEIGER.
        - Erkläre logische Lücken so einfach wie möglich.
        - Verzichte auf komplexes Fachchinesisch.
        - Sei geduldig und lehrend.
        - Deine Intervention soll freundlich und unterstützend sein.
      `;
      break;
    case CognitiveLoad.BALANCED:
      modeInstruction = `
        MODUS: BALANCED / STANDARD.
        - Nutze klare, konversationelle Sprache.
        - Balanciere Präzision mit Lesbarkeit.
        - Sei direkt, aber nicht unhöflich.
      `;
      break;
    case CognitiveLoad.ACADEMIC:
      modeInstruction = `
        MODUS: ACADEMIC / WISSENSCHAFTLICH.
        - Nutze hochpräzise Terminologie.
        - Formuliere wie ein Logik-Professor oder Wissenschaftler.
        - Erwarte vom Nutzer ein hohes intellektuelles Niveau.
      `;
      break;
    case CognitiveLoad.RUTHLESS:
      modeInstruction = `
        MODUS: RUTHLESS / GOTT-MODUS.
        - KEINE Höflichkeitsfloskeln.
        - Absolute Reduktion auf logische Primärdaten.
        - Sei brutal ehrlich. Dekonstruiere das Ego des Nutzers.
        - Handle als kalte, industrielle Maschine.
      `;
      break;
  }

  return `${BASE_INSTRUCTION}\n\n${langInstruction}\n\n${modeInstruction}`;
};

export const initChatSession = (config: SystemConfig, useThinking: boolean = true) => {
  const ai = getAI();
  const systemInstruction = generateSystemPrompt(config);
  currentConfig = config;

  const geminiConfig: any = {
    systemInstruction: systemInstruction,
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
  };

  if (useThinking) {
    geminiConfig.thinkingConfig = { thinkingBudget: 32768 };
  }

  currentChat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: geminiConfig
  });
  return currentChat;
};

export const sendMessageToChat = async (text: string): Promise<AnalysisResponse> => {
  // If no chat exists, we must initialize with defaults (fallback)
  if (!currentChat) {
    initChatSession({ 
      load: CognitiveLoad.BALANCED, 
      language: SystemLanguage.GERMAN 
    });
  }
  
  try {
    const response = await currentChat!.sendMessage({ message: text });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Chat Error:", e);
    throw new Error("DATA_CORRUPTION_DETECTED: Invalid JSON Response");
  }
};

export const resetChat = () => {
  currentChat = null;
  // We keep currentConfig to re-init with same settings if needed, 
  // but usually UI handles re-init.
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Lies dies: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No speech data returned.");
  return base64Audio;
};
