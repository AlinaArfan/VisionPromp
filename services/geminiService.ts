
import { GoogleGenAI, Type } from "@google/genai";
import { PromptAnalysis } from "../types";

const sanitizeJson = (text: string): string => {
  return text.replace(/```json\n?|```/g, "").trim();
};

const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API Key belum terdeteksi. Silakan klik tombol 'Select API Key' di atas.");
  }
  return new GoogleGenAI({ apiKey });
};

export const detectProductFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: "Identify the main product or central object in this image. Provide only the specific name/model/brand. If no clear product is found, return 'Product'. Be very concise, maximum 5 words." }
        ]
      },
      config: { temperature: 0.1 }
    });
    return response.text?.trim() || "Product";
  } catch (err) {
    console.error("Detection error:", err);
    return "Product";
  }
};

export const analyzeImageToPrompt = async (
  base64Image: string, 
  mimeType: string, 
  productName?: string
): Promise<PromptAnalysis> => {
  const systemInstruction = `You are a professional AI Prompt Engineer and Commercial Photographer. 
Analyze the uploaded image to extract its artistic style, lighting, and composition. 
Describe a high-end commercial photography setting where the product '${productName || 'a product'}' can be naturally placed.
The prompt must focus on the environment, textures, and lighting.`;

  try {
    const ai = getAiInstance();
    // Gunakan Pro untuk kualitas terbaik, jika gagal user mungkin butuh key baru
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: `Analyze this scene. Create a detailed prompt for a ${productName || 'product'} photoshoot in this style.` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mainPrompt: { type: Type.STRING },
            subject: { type: Type.STRING },
            style: { type: Type.STRING },
            lighting: { type: Type.STRING },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            composition: { type: Type.STRING },
            technicalSpecs: { type: Type.STRING }
          },
          required: ["mainPrompt", "subject", "style", "lighting", "colors", "composition", "technicalSpecs"]
        }
      }
    });

    const cleanJson = sanitizeJson(response.text || "{}");
    return JSON.parse(cleanJson) as PromptAnalysis;
  } catch (error: any) {
    console.error("Analysis API Error:", error);
    if (error.message?.includes("entity was not found") || error.message?.includes("API Key")) {
      throw new Error("Model atau API Key tidak valid. Pastikan Anda menggunakan API Key dari project GCP yang sudah mengaktifkan billing.");
    }
    throw new Error(error.message || "Gagal menganalisis gambar.");
  }
};

export const generateImageFromPrompt = async (
  prompt: string, 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1",
  productImage?: { data: string, mimeType: string }
): Promise<string> => {
  try {
    const ai = getAiInstance();
    const contentsParts: any[] = [];
    
    if (productImage) {
      contentsParts.push({
        inlineData: {
          data: productImage.data,
          mimeType: productImage.mimeType
        }
      });
      contentsParts.push({
        text: `Place the product from the image into this scene: ${prompt}. Preserve product identity perfectly. 8k photorealistic.`
      });
    } else {
      contentsParts.push({
        text: `Professional photography: ${prompt}. Cinematic lighting, 8k.`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: contentsParts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K"
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("AI tidak mengirimkan data gambar.");
  } catch (error: any) {
    console.error("Generation API Error:", error);
    throw new Error(error.message || "Gagal membuat gambar.");
  }
};
