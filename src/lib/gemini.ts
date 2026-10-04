import { GoogleGenAI, Type, Schema } from "@google/genai";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    is_future_actionable: {
      type: Type.BOOLEAN,
      description: "TIME-FIRST EVALUATION: Set to true if the item is an upcoming event, meeting, call, deadline, errand, appointment, or future task with a scheduled or implied future time (e.g. 'call Rohit at 4 PM', 'MBA event on Oct 13', 'dentist tomorrow'). Set to false if it already occurred or is a subjective reflection/quote/idea.",
    },
    category: {
      type: Type.STRING,
      description: "STRICT RULE: If is_future_actionable is true, category MUST be exactly one of: 'Task', 'Reminder', 'Event'. If is_future_actionable is false, category MUST be exactly one of: 'Milestone_HardWork', 'Quiet_Moment', 'Hard_Truth', 'Perspective_Lesson', 'Idea_Desire', 'Shaairi_Quote'.",
    },
    life_texture: {
      type: Type.STRING,
      description: "If is_future_actionable is true, life_texture MUST be 'actionable_obligation'. If is_future_actionable is false, life_texture MUST be one of: 'hard_work', 'quiet_moment', 'hard_truth', 'perspective', 'idea_spark', 'shaairi_quote'.",
    },
    content: {
      type: Type.STRING,
      description: "The extracted single atomic snippet of text (never lump multiple distinct thoughts together)",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Tags for the graph (e.g. ['call', 'rohit'] or ['trading', 'loss'] or ['reading', 'books'])",
    },
    sentiment_or_mood: {
      type: Type.STRING,
      description: "e.g. focused, urgent, reflective, heavy, calm, excited, neutral",
    },
    event_timestamp: {
      type: Type.STRING,
      description: "Strict ISO 8601 string (e.g. '2026-10-04T16:00:00Z'). For future items, calculate the target event/call/deadline time relative to Current Absolute Time. For past items, calculate the past occurrence time if relative time is used; otherwise default to Current Absolute Time.",
    },
    calendar_action: {
      type: Type.OBJECT,
      properties: {
        is_actionable: {
          type: Type.BOOLEAN,
          description: "MUST MATCH is_future_actionable. Set to true ONLY if the item describes a future action, call, appointment, deadline, or scheduled event.",
        },
        title: {
          type: Type.STRING,
          description: "A clean, concise title for Google Calendar (e.g. 'Call Rohit', 'MBA Orientation Event', 'Renew Gym Membership').",
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
  required: ["is_future_actionable", "category", "life_texture", "content", "tags", "event_timestamp", "calendar_action"],
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
    "gemini-2.0-flash",
  ];

  const nowIso = context?.currentTime || new Date().toISOString();
  const tz = context?.timezone || "UTC";

  const prompt = `You are an advanced temporal, conceptual, and action-oriented NLP engine for August (Life Ledger & Knowledge Mirror).

TEMPORAL CONTEXT:
- Current Absolute Time: ${nowIso}
- User Timezone: ${tz}

CRITICAL "TIME-FIRST" EVALUATION PROTOCOL (STRICT TWO-PHASE LOGIC):

Before assigning any category or subjective life texture, you MUST evaluate temporal intent by answering:
-> Is this item a future actionable obligation, upcoming call, appointment, or scheduled event? (is_future_actionable: boolean)

============================================================
PHASE 1: IF is_future_actionable IS TRUE
============================================================
- The item describes something in the future that needs to be done, called, or attended (e.g., "call today Rohit at 4 PM", "upcoming MBA event on Oct 13", "dentist appointment on Monday", "buy milk tomorrow", "finish assignment by 8 PM").
- STRICT PROHIBITION: You are STRICTLY FORBIDDEN from categorizing future items as subjective reflections (such as Milestone, Quiet Moment, Hard Truth, or Perspective). A phone call at 4 PM is NOT a Milestone! An upcoming MBA event is NOT a Quiet Moment!
- You MUST assign category as one of:
  * 'Task' (errands, to-dos, tasks to complete)
  * 'Reminder' (calls to make, bills to pay, check-ins)
  * 'Event' (scheduled meetings, orientations, calendar dates, flights)
- You MUST assign life_texture as: 'actionable_obligation'
- You MUST set calendar_action:
  * is_actionable: true
  * title: clean event title (e.g. "Call Rohit", "MBA Event")
  * start_time: mathematically calculated ISO 8601 timestamp based on Current Absolute Time (${nowIso})
  * end_time: ISO 8601 timestamp (start_time + 30 mins if unspecified)

============================================================
PHASE 2: IF is_future_actionable IS FALSE
============================================================
- The item already happened in the past, is an emotional state, a financial setback, a completed achievement, or a timeless quote/idea.
- ONLY in this phase are you permitted to route into Life Ledger reflection textures:
  * 'Milestone_HardWork' (life_texture: 'hard_work'): Major completed achievements, submitted PRs/applications, finished exams, shipped milestones. (NEVER future calls or errands!).
  * 'Quiet_Moment' (life_texture: 'quiet_moment'): Past micro-moments, quiet walks, meaningful conversations that happened, listening to music, small joys. (NEVER upcoming scheduled events or obligations!).
  * 'Hard_Truth' (life_texture: 'hard_truth'): Financial losses, trading setbacks, big expenses, emotional difficulties, or mistakes that occurred.
  * 'Perspective_Lesson' (life_texture: 'perspective'): Reflections from books, wisdom, philosophical shifts, lessons learned.
  * 'Idea_Desire' (life_texture: 'idea_spark'): Creative ideas, product concepts, future wishlist desires (non-time-bound).
  * 'Shaairi_Quote' (life_texture: 'shaairi_quote'): Poetry, lyrics, or quotes.
- You MUST set calendar_action.is_actionable: false.

CRITICAL "PASTE AND SPLIT" PROTOCOL:
- When a user inputs a wall of text, multiple sentences, bullet points, numbered lines, or disjointed thoughts, you MUST NEVER treat it as one single lump thought.
- You MUST slice and split the input into separate, individual atomic items in the output array.
- For EACH item sliced, execute Phase 1 (Time Evaluation) then Phase 2 (Categorization).

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
    "gemini-3-flash-preview",
    "gemini-2.0-flash",
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


