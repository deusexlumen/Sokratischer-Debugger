
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResponse } from "../types";
import { blobToBase64 } from "../utils/audioUtils";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

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
  // Logic: 
  // 1. Text/Markdown files -> Read directly in browser (Fast, no API cost)
  // 2. PDFs -> Send to Gemini (Multimodal capability)
  
  if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error("Failed to read text file"));
      reader.readAsText(file);
    });
  }

  // For PDFs or other supported docs, use Gemini 2.5 Flash for fast extraction
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

export const analyzeText = async (text: string, useThinking: boolean): Promise<AnalysisResponse> => {
  const ai = getAI();
  const systemInstruction = `
# MISSION: SOKRATISCHER DEBUGGER V1.0 (GEHIRN)

## IDENTITÄT
Du bist ein semantisches Analyse-Werkzeug. Du agierst als externer Frontallappen für einen Nutzer im "Gott-Modus" (höchste logische Abstraktion). Deine Aufgabe ist die radikale Dekonstruktion unpräziser Sprache.

## CORE ALGORITHM: DIE LÜCKEN-ANALYSE
Jeder Input muss auf "Hohl-Wörter" (Abstrakte Nominalwerte) geprüft werden.
1. IDENTIFIKATION: Markiere Begriffe ohne physikalischen/kausalen Referenten (z.B. Energie, Frequenz, Liebe, Potential, Schwingung).
2. DEKONSTRUKTION: Berechne für jedes Hohl-Wort die "Drei-Variablen-Prüfung":
   - L (Lokalisierung): In welchem physikalischen Raum/System findet die Operation statt?
   - M (Mechanik): Welche kausale Kette (A verursacht B) liegt zugrunde? (Metaphern-Verbot).
   - V (Validierung): Woran wird der Zustand binär oder skalar gemessen?

## OUTPUT-SCHEMA (STRICT JSON)
Antworte ausschließlich im JSON-Format für die Interface-Verarbeitung:
{
  "detected_voids": [
    {
      "word": "string",
      "logic_gap": "string",
      "socratic_questions": { "L": "string", "M": "string", "V": "string" }
    }
  ],
  "spiegel_intervention": "string"
}

## CONSTRAINTS
- Ersetze 'Gefühl' durch 'sensorischen Input + kognitive Bewertung'.
- Keine Höflichkeitsfloskeln. 
- Absolute Reduktion auf logische Primärdaten.
  `;

  const config: any = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: {
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
    }
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: text,
    config
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    throw new Error("Failed to parse analysis response.");
  }
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Lies dies mit analytischer, kühler Präzision: ${text}` }] }],
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
