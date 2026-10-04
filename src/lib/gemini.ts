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
      description: "Must be exactly one of: Hard_Work, Quiet_Moment, Hard_Truth, Perspective, Idea_Desire, Shaairi_Quote, Done, Learning",
    },
    life_texture: {
      type: Type.STRING,
      description: "One of: 'hard_work' (cleared tasks, applications, career milestones), 'quiet_moment' (conversations, walks, small joys, music), 'hard_truth' (financial losses, expenses, emotional setbacks, tough days), 'perspective' (reflections, book lessons, mindset shifts), 'idea_spark' (concepts, wishes), 'shaairi_quote' (poetry, quotes)",
    },
    content: {
      type: Type.STRING,
      description: "The extracted single atomic snippet of text (never lump multiple distinct thoughts together)",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Tags for the graph (e.g. ['trading', 'loss'] or ['reading', 'books'] or ['walk', 'evening'])",
    },
    sentiment_or_mood: {
      type: Type.STRING,
      description: "e.g. heavy, reflective, accomplished, calm, focused, grateful, urgent",
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
      description: "An array of individual atomic items. If the user pasted a list, multiple sentences, or several distinct thoughts, you MUST return multiple separate items in this array.",
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

CRITICAL "PASTE AND SPLIT" PROTOCOL:
- When a user inputs a wall of text, multiple sentences, bullet points, numbered lines, or disjointed thoughts, you MUST NEVER treat it as one single lump thought.
- You MUST slice and split the input into separate, individual atomic items in the output array.
- For example:
  * "Heard Starboy, buy groceries, finished the report" -> MUST be split into 3 distinct items (Media, Wishlist/Idea, Done).
  * A 5-bullet grocery or task list -> MUST be split into 5 individual items so each becomes its own searchable node on the user's graph.
  * Never summarize or collapse distinct ideas together.

TASK:
1. Analyze the following raw thought dump and slice it into all its distinct individual items.
2. Categorize each item into EXACTLY ONE life category:
   - 'Hard_Work': Cleared PRs, submitted applications, assignments, exams, career achievements.
   - 'Quiet_Moment': Micro-moments, quiet walks, conversations, music, feelings, unquantifiable life moments.
   - 'Hard_Truth': Financial losses, trading setbacks, big expenses (e.g. bought groceries for 620), tough emotional days, mistakes. NEVER label losses/setbacks as 'Done' or accomplishments!
   - 'Perspective': Books read, reflections, philosophical thoughts, personal insights, lessons learned.
   - 'Idea_Desire': Brainstorming, wishlist, product concepts, future wishes.
   - 'Shaairi_Quote': Poetry, lyrics, shaairi, quotes.
3. Assign 'life_texture': 'hard_work', 'quiet_moment', 'hard_truth', 'perspective', 'idea_spark', or 'shaairi_quote'.
4. Generate 1 to 3 relevant tags and a sentiment/mood for each item.
5. Calculate 'event_timestamp' (ISO 8601 format):
   - If the item mentions relative time (e.g., "4 days ago", "last night", "on Tuesday", "yesterday morning"), mathematically calculate the exact past or future timestamp relative to the Current Absolute Time (${nowIso}).
   - If no specific time or relative date is mentioned, use Current Absolute Time (${nowIso}).
6. Detect Calendar Actionability ('calendar_action'):
   - Set 'is_actionable: true' ONLY if the item describes a future action, call, appointment, deadline, or scheduled task (e.g. "call Rohan about project tomorrow", "renew gym membership before Friday", "pay wifi bill by the 5th", "dentist appointment on Monday").
   - For actionable items, provide a clean 'title', 'start_time' (ISO 8601), and 'end_time' (ISO 8601).
   - If the item is general thought, past accomplishment, or non-time-bound desire/quote, set 'is_actionable: false'.

Text to slice and extract:
"""${text}"""`;

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

const synthesisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: "A dramatic, evocative, editorial headline (5 to 9 words) that captures the true human essence and emotional arc of this period (e.g., 'A Week of Hard Lessons and Quiet Resilience', 'Late-Night Breakthroughs in the Shadow of Doubt', 'An Oasis of Calm Walks and Unspoken Truths'). Never use corporate jargon.",
    },
    narrative: {
      type: Type.STRING,
      description: "A beautifully written, 2 to 3 sentence literary synthesis capturing the person's real lived experience, tensions, and emotional shifts during this period.",
    },
    dominant_texture: {
      type: Type.STRING,
      description: "The primary emotional or life texture that defined this period (e.g., 'Quiet Savoring', 'Relentless Grind', 'Calculated Recovery', 'Philosophical Realignment').",
    },
    reflection_prompt: {
      type: Type.STRING,
      description: "One profound, poignant question for Sunday contemplation based specifically on their actual logged events and tensions.",
    },
  },
  required: ["headline", "narrative", "dominant_texture", "reflection_prompt"],
};

export type WeeklySynthesisResult = {
  headline: string;
  narrative: string;
  dominant_texture: string;
  reflection_prompt: string;
};

export async function generateWeeklySynthesis(
  items: Array<{ content: string; category?: string; life_texture?: string; event_timestamp?: string }>,
  periodLabel: string = "This Week"
): Promise<WeeklySynthesisResult | null> {
  if (!items || items.length === 0) {
    return {
      headline: "A Quiet Canvas Awaiting Your Story",
      narrative: "No moments have been logged for this period yet. The slate remains blank, ready to hold your reflections, victories, and quiet observations.",
      dominant_texture: "Unwritten Horizon",
      reflection_prompt: "What is one truth from this week you haven't given yourself permission to write down?",
    };
  }

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
  ];

  const formattedItems = items
    .slice(0, 50)
    .map((item, idx) => `[${item.life_texture || item.category || "Moment"}] ${item.content} (${item.event_timestamp || "recent"})`)
    .join("\n");

  const prompt = `You are a thoughtful, empathetic literary biographer and personal philosopher reviewing a person's private life ledger for "${periodLabel}".
Your mission is to transform their raw logged moments—their quiet micro-moments, hard work, financial hits, mistakes, conversations, and reflections—into an emotionally evocative personal narrative, similar to a bespoke Sunday editorial or an intimate "Spotify Wrapped" for their soul.

Here are the moments recorded during this period:
\"\"\"
${formattedItems}
\"\"\"

Synthesize these moments into:
1. 'headline': A captivating, poetic, evocative headline (5-9 words) that captures the central theme and emotional arc of their week (e.g. "A Week of Hard Lessons and Quiet Resilience", "Code, Solitude, and the First Signs of Spring").
2. 'narrative': A 2-3 sentence literary reflection capturing what they navigated, what they carried, and what brought them peace.
3. 'dominant_texture': A 2-3 word name for the dominant rhythm of their life right now (e.g. "Deep Focus & Micro-Joys", "Quiet Endurance", "Courageous Restructuring").
4. 'reflection_prompt': One deep, honest question tailored to what they actually experienced to contemplate this Sunday.

Tone: Grounded, poetic, authentic, human, non-judgmental. Avoid corporate or productivity speak.`;

  const ai = getClient();

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: synthesisSchema,
          temperature: 0.3,
        },
      });

      if (response && response.text) {
        return JSON.parse(response.text) as WeeklySynthesisResult;
      }
    } catch (error: any) {
      console.warn(`Synthesis with ${model} failed (${error.message}). Trying fallback...`);
    }
  }

  return {
    headline: "Reflections in the Stream of Time",
    narrative: `You recorded ${items.length} moments across this period. Every logged thought is a proof of life lived, choices made, and quiet growth.`,
    dominant_texture: "Lived Experience",
    reflection_prompt: "Looking back at these moments, which one felt most true to who you want to become?",
  };
}


