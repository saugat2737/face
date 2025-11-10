
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Emotion } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const emotionValues = Object.values(Emotion);

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    emotion: {
      type: Type.STRING,
      enum: emotionValues,
      description: "The primary emotion detected from the person's facial expression."
    },
    environmentAnalysis: {
      type: Type.STRING,
      description: "A brief analysis of the user's environment (e.g., lighting, background clutter)."
    },
    encouragingMessage: {
      type: Type.STRING,
      description: "A short, positive, and encouraging message tailored to the detected emotion."
    },
    productivityTip: {
      type: Type.STRING,
      description: "A concise and actionable productivity tip relevant to the user's current emotional state."
    }
  },
  required: ["emotion", "environmentAnalysis", "encouragingMessage", "productivityTip"]
};

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: `Analyze the person's facial expression in this image to determine their primary emotion. Also, analyze their environment (e.g., lighting, background). Based on this, provide an encouraging message and a productivity tip. Respond with only a valid JSON object matching the provided schema.`
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    
    // Validate emotion enum
    if (!emotionValues.includes(result.emotion as Emotion)) {
        console.warn(`Received unknown emotion: ${result.emotion}. Defaulting to NEUTRAL.`);
        result.emotion = Emotion.NEUTRAL;
    }
    
    return result as AnalysisResult;
  } catch (error) {
    console.error("Error analyzing image with Gemini API:", error);
    throw new Error("Failed to get analysis from Gemini API. Please check your API key and network connection.");
  }
};
