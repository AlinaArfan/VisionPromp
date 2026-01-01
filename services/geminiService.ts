
import { GoogleGenAI, Type } from "@google/genai";
import { PromptAnalysis } from "../types";

export const detectProductFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: { mimeType, data: base64Image }
        },
        {
          text: "Identify the main product or central object in this image. Provide only the specific name/model/brand (e.g., 'Sony WH-1000XM4 Headphones'). If no clear product is found, return 'Product'. Be very concise, maximum 5 words."
        }
      ]
    },
    config: {
      temperature: 0.1,
    }
  });

  return response.text?.trim() || "Product";
};

export const analyzeImageToPrompt = async (
  base64Image: string, 
  mimeType: string, 
  productName?: string
): Promise<PromptAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `You are a professional AI Prompt Engineer and Photographer. 
Analyze the uploaded scene image to extract its artistic style, lighting, and composition environment. 
The goal is to describe a setting where a product can be placed.

Return the response as a valid JSON object.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: `Analyze this scene's lighting, mood, and background details. Create a prompt for a ${productName || 'product'} photoshoot in this exact environment.` }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mainPrompt: { type: Type.STRING, description: "The full descriptive prompt for the scene." },
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

  try {
    return JSON.parse(response.text || "{}") as PromptAnalysis;
  } catch (error) {
    throw new Error("Failed to parse analysis results.");
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
      text: `STRICT FIDELITY: Place the EXACT product from the reference image into this new scene: ${prompt}. 
      Do not change the product's shape, color, branding, or texture. It must look 100% identical but naturally lit by the scene. 
      Professional commercial photography, 8k, photorealistic.`
    });
  } else {
    contentsParts.push({
      text: `Professional commercial photography of: ${prompt}. High-end lighting, 8k resolution, photorealistic.`
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: contentsParts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image was returned.");
};
