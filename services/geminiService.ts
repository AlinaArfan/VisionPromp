
import { GoogleGenAI, Type } from "@google/genai";
import { PromptAnalysis } from "../types";

const sanitizeJson = (text: string): string => {
  return text.replace(/```json\n?|```/g, "").trim();
};

export const detectProductFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `You are a professional AI Prompt Engineer and Commercial Photographer. 
Analyze the uploaded image to extract its artistic style, lighting, and composition. 
Describe a high-end commercial photography setting where the product '${productName || 'a product'}' can be naturally placed.
The prompt must focus on the environment, textures, and lighting.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: `Analyze this scene. Create a detailed prompt for a ${productName || 'product'} photoshoot in this exact style and environment.` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mainPrompt: { type: Type.STRING, description: "Detailed prompt for the full scene." },
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
    if (error.message?.includes("entity was not found")) {
      throw new Error("API Key configuration error. Please re-select your API key.");
    }
    throw new Error(error.message || "Failed to analyze image.");
  }
};

export const generateImageFromPrompt = async (
  prompt: string, 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1",
  productImage?: { data: string, mimeType: string }
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contentsParts: any[] = [];
  
  if (productImage) {
    contentsParts.push({
      inlineData: {
        data: productImage.data,
        mimeType: productImage.mimeType
      }
    });
    contentsParts.push({
      text: `TASK: Place the product from the reference image into this scene: ${prompt}.
      MANDATORY: Preserve 100% of the product's identity, logos, and shape. 
      Professional 8k commercial photography, realistic lighting integration, photorealistic.`
    });
  } else {
    contentsParts.push({
      text: `Professional high-end commercial photography of: ${prompt}. Cinematic lighting, 8k resolution, photorealistic.`
    });
  }

  try {
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
    throw new Error("No image data received from AI.");
  } catch (error: any) {
    console.error("Generation API Error:", error);
    throw new Error(error.message || "Image generation failed.");
  }
};
