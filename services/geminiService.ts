import { GoogleGenAI, Type } from "@google/genai";
import { Category, ClothingItem, OutfitRecommendation } from "../types";

// Always create a fresh instance when needed to pick up the latest env key, 
// though generally process.env.API_KEY is static. 
// We will instantiate inside functions or ensure the key is ready.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to convert File or Blob to Base64 string (without data prefix for Gemini)
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- 1. Analyze Clothing ---

export const analyzeClothingImage = async (base64Data: string): Promise<Partial<ClothingItem>> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: "Analyze this clothing item. Identify the category, color, a short description, and style tags." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { 
              type: Type.STRING, 
              enum: [
                "上装", "下装", "裙装", "外套", "鞋履", "配饰", "其他"
              ] 
            },
            color: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["category", "color", "description", "tags"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    
    return {
      category: result.category as Category,
      color: result.color,
      description: result.description,
      tags: result.tags
    };
  } catch (error) {
    console.error("Error analyzing clothing:", error);
    throw error;
  }
};

// --- 2. Generate Try-On ---

export const generateTryOnImage = async (
  modelBase64: string, 
  clothingBase64s: string[]
): Promise<string> => {
  try {
    if (clothingBase64s.length === 0) throw new Error("No clothing provided");

    const ai = getAI();
    const parts: any[] = [
       { inlineData: { mimeType: "image/jpeg", data: modelBase64 } },
       { text: "This is the model person. Keep their face and body identity consistent." }
    ];

    clothingBase64s.forEach((clothB64, index) => {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: clothB64 } });
      parts.push({ text: `Clothing item #${index + 1} to be worn by the model.` });
    });

    const prompt = "Generate a photorealistic image of the model wearing the provided clothing items. Ensure the clothes fit naturally and the lighting is professional. Output only the final image.";

    // Use gemini-3-pro-image-preview for high quality generation
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          ...parts,
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "3:4", 
            imageSize: "1K"
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image generated");
  } catch (error) {
    console.error("Try-on generation failed:", error);
    throw error;
  }
};

// --- 3. Recommend Outfits ---

export const getOutfitRecommendations = async (clothes: ClothingItem[]): Promise<OutfitRecommendation[]> => {
  try {
    const ai = getAI();
    // Pass ID to map back
    const inventory = clothes.map(c => `ID: ${c.id} | ${c.category}: ${c.description} (${c.color})`).join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on the following wardrobe inventory, suggest 3 stylish and trendy outfits suitable for the current season.
      Return the specific IDs of the items used in the 'relatedItemIds' field.
      
      Inventory:
      ${inventory}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              items: { type: Type.ARRAY, items: { type: Type.STRING } },
              relatedItemIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The exact IDs of the items from the inventory used in this outfit" },
              reasoning: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Recommendation failed:", error);
    throw error;
  }
};