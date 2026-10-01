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
    },
    event_timestamp: {
      type: Type.STRING,
      description: "Strict ISO 8601 string (e.g. '2026-09-27T16:00:00Z'). Mathematically calculate the real-world occurrence time if relative time (e.g. '4 days ago', 'last night', 'yesterday', '2 weeks back') is used, based on Current Absolute Time. If no time is specified in the text, default to the Current Absolute Time.",
    },
    calendar_action: {
      type: Type.OBJECT,
      properties: {
        is_actionable: {
          type: Type.BOOLEAN,
          description: "Set to true ONLY if the text explicitly describes a future task, call, meeting, deadline, appointment, or errand with a temporal trigger (e.g., 'tomorrow', 'before Friday', 'at 5 PM', 'next Monday'). Otherwise false.",
        },
        title: {
          type: Type.STRING,
          description: "A concise, clean calendar event title (e.g. 'Call Rohan - Project Deadline', 'Renew Gym Membership').",
        },
        start_time: {
          type: Type.STRING,
          description: "ISO 8601 datetime string for event start time, computed relative to Current Absolute Time.",
        },
        end_time: {
          type: Type.STRING,
          description: "ISO 8601 datetime string for event end time (default to 30 minutes after start_time if unspecified).",
        },
      },
      required: ["is_actionable"],
    },
  },
  required: ["category", "content", "tags", "event_timestamp", "calendar_action"],
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

export async function extractItems(
  text: string,
  context?: { currentTime?: string; timezone?: string }
) {
  const candidateModels = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
  ];

  const nowIso = context?.currentTime || new Date().toISOString();
  const tz = context?.timezone || "UTC";

  const prompt = `You are an advanced temporal, conceptual, and action-oriented NLP engine for a note-taking app.

TEMPORAL CONTEXT:
- Current Absolute Time: ${nowIso}
- User Timezone: ${tz}

TASK:
1. Analyze the following raw thought dump and extract distinct items.
2. Categorize each item into EXACTLY ONE category: Done, Idea, Wishlist, Media, Shaairi_Quote, Learning.
3. Generate 1 to 3 relevant tags and a sentiment/mood for each item.
4. Calculate 'event_timestamp' (ISO 8601 format):
   - If the note mentions relative time (e.g., "4 days ago", "last night", "on Tuesday", "yesterday morning"), mathematically calculate the exact past or future timestamp relative to the Current Absolute Time (${nowIso}).
   - If no specific time or relative date is mentioned, use Current Absolute Time (${nowIso}).
5. Detect Calendar Actionability ('calendar_action'):
   - Set 'is_actionable: true' ONLY if the item describes a future action, call, appointment, deadline, or scheduled task (e.g. "call Rohan about project tomorrow", "renew gym membership before Friday", "pay wifi bill by the 5th", "dentist appointment on Monday").
   - For actionable items, provide a clean 'title', 'start_time' (ISO 8601), and 'end_time' (ISO 8601).
   - If the item is general thought, past accomplishment, or non-time-bound desire/quote, set 'is_actionable: false'.

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

