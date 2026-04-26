import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedMetadata } from "../types";

const metadataSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, commercial, SEO-friendly title (max 70 characters)",
    },
    description: {
      type: Type.STRING,
      description: "Descriptive sentence for Shutterstock, max 200 characters.",
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "35-50 highly relevant tags, ordered by relevance (most important first)",
    },
    categories: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Select 1 or 2 Shutterstock categories: Animals/Wildlife, The Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and Drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage",
    },
    isEditorial: {
      type: Type.BOOLEAN,
      description: "Is this an editorial image (contains logos, famous people, or news events)?",
    },
    isMature: {
      type: Type.BOOLEAN,
      description: "Does this contain adult/mature content?",
    },
    isIllustration: {
      type: Type.BOOLEAN,
      description: "Is this a digital illustration or vector-style image?",
    },
    analysis: {
      type: Type.OBJECT,
      properties: {
        objects: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Main objects detected in the scene",
        },
        sceneType: {
          type: Type.STRING,
          description: "Indoor, outdoor, studio, abstract, etc.",
        },
        composition: {
          type: Type.STRING,
          description: "Minimal, flat lay, close-up, wide-angle, etc.",
        },
        colors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Dominant color palette descriptions",
        },
      },
      required: ["objects", "sceneType", "composition", "colors"],
    },
  },
  required: ["title", "description", "keywords", "categories", "isEditorial", "isMature", "isIllustration", "analysis"],
};

export async function analyzeImage(base64Data: string, mimeType: string, customApiKey?: string): Promise<GeneratedMetadata> {
  const apiKey = customApiKey || (process.env.GEMINI_API_KEY as string);
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this image for global stock marketplaces (Shutterstock, Adobe Stock, Freepik). 
  
  Generate professional metadata that follows these strict guidelines:
  1. Title: High CTR, SEO-optimized, max 70 chars. Focus on the main subject and action.
  2. Description: Accurate description, no keyword stuffing, max 200 chars. (To be used as "Title" in Adobe Stock/Freepik).
  3. Keywords: 35-50 highly relevant tags. Order them by relevance (most important first). Minimum 35 keywords.
  4. Categories: Choose up to 2 accurate categories from the list provided in the schema.
  5. Flags: Identify if it's Editorial (logos/famous people), Mature content, or an Illustration.
  6. Analysis: Detect objects, scene, and colors for UI context.

  Rules:
  - NO trademarked names (e.g., say "smartphone" not "iPhone").
  - NO copyright content.
  - Return the results in strict JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: metadataSchema,
      }
    });

    if (!response.text) {
      throw new Error("No response text from Gemini");
    }

    return JSON.parse(response.text) as GeneratedMetadata;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
