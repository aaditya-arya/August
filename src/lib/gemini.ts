import { GoogleGenAI, Type, Schema } from "@google/genai";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      description: "Must be exactly one of: Done, Idea, Wishlist, Media, Shaairi_Quote, Learning",
    },
    content: {
      type: Type.STRING,
      description: "The extracted snippet of text",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Tags for the graph (e.g. ['urdu', 'poetry'] or ['freelance', 'client'])",
    },
    sentiment_or_mood: {
      type: Type.STRING,
      description: "e.g. reflective, urgent, ambitious",
    }
  },
  required: ["category", "content", "tags"],
};

const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: itemSchema,
    },
  },
  required: ["items"],
};

export async function extractItems(text: string) {
  const candidateModels = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
  ];

  const prompt = `You are a smart NLP engine for a note-taking app. 
Analyze the following text dump and extract distinct items. 
Categorize each into EXACTLY ONE of the following categories: Done, Idea, Wishlist, Media, Shaairi_Quote, Learning.
Generate tags (max 3 per item) and a sentiment or mood.

Text: "${text}"`;

  const ai = getClient();

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: extractionSchema,
          temperature: 0.1,
        },
      });

      if (response && response.text) {
        const data = JSON.parse(response.text);
        return data.items || [];
      }
    } catch (error: any) {
      console.warn(`Model ${model} unavailable (${error.status || error.message}). Trying fallback...`);
    }
  }

  console.error("All candidate Gemini extraction models failed.");
  return [];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getClient();
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768,
      }
    });
    
    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values || [];
    }
    return [];
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    return [];
  }
}

