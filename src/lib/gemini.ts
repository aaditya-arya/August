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
      description: "TIME-FIRST EVALUATION: Set to true ONLY if the item has an explicit future scheduled date, time, call, appointment, or deadline (e.g. 'call Rohit at 4 PM', 'MBA event on Oct 13', 'dentist tomorrow at 10am'). Set to false for all past events, timeless intentions/wishlists, thoughts, setbacks, reflections, and media consumption.",
    },
    category: {
      type: Type.STRING,
      description: "Must be exactly one of: 'Task', 'Reminder', 'Event', 'Milestone_HardWork', 'Idea_Desire', 'Hard_Truth', 'Perspective_Lesson', 'Quiet_Moment', 'Media_Log', 'Shaairi_Quote'.",
    },
    life_texture: {
      type: Type.STRING,
      description: "One of: 'actionable_obligation' (for future scheduled tasks/events), 'hard_work' (completed past hard work/milestones), 'idea_spark' (wishlists, intentions, uncompleted goals, concepts), 'hard_truth' (losses, bills, expenses, setbacks), 'perspective' (book lessons, wisdom), 'quiet_moment' (past micro-moments, tranquil walks, deep conversations), 'media_log' (songs, music, movies, trailers, games, anime, entertainment consumption), 'shaairi_quote' (poetry, lyrics).",
    },
    content: {
      type: Type.STRING,
      description: "The extracted single atomic snippet of text (never lump multiple distinct thoughts together)",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Tags for the graph (e.g. ['shoes', 'wishlist'] or ['music', 'pop'] or ['trading', 'loss'])",
    },
    sentiment_or_mood: {
      type: Type.STRING,
      description: "e.g. focused, aspiring, entertained, heavy, calm, reflective, neutral",
    },
    event_timestamp: {
      type: Type.STRING,
      description: "Strict ISO 8601 string (e.g. '2026-10-04T16:00:00Z'). For future items, calculate the target event/call/deadline time. For past items, calculate the past occurrence time if relative time is used; otherwise default to Current Absolute Time.",
    },
    calendar_action: {
      type: Type.OBJECT,
      properties: {
        is_actionable: {
          type: Type.BOOLEAN,
          description: "MUST MATCH is_future_actionable. Set to true ONLY if the item describes a future action, call, appointment, deadline, or scheduled event with a temporal trigger.",
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
    "gemini-flash-latest",
    "gemini-3.8-flash",
  ];

  const nowIso = context?.currentTime || new Date().toISOString();
  const tz = context?.timezone || "UTC";

  const prompt = `You are an advanced temporal, conceptual, and action-oriented NLP engine for August (Life Ledger & Knowledge Mirror).

TEMPORAL CONTEXT:
- Current Absolute Time: ${nowIso}
- User Timezone: ${tz}

CRITICAL CATEGORIZATION RULES & STRICT DELINEATIONS (AVOID THE MILESTONE LEAK):

1. 'Media_Log' (life_texture: 'media_log'):
   - If the text describes listening to a song/album/podcast, watching a movie/trailer/anime/show, or playing a video game (e.g. "Heard Starboy", "watched the new Batman trailer", "listening to AP Dhillon", "played FIFA with friends"), you MUST classify it as 'Media_Log'.
   - Media consumption is strictly CONSUMPTION, NOT a 'Quiet_Moment' and NEVER a 'Milestone'!

2. 'Idea_Desire' (life_texture: 'idea_spark'):
   - For timeless intentions, wishlist items, things to buy, books to read, uncompleted aspirations, and creative concepts (e.g., "want to get a pair of running shoes", "want to start 'Ikigai'", "idea for a study planner app", "thinking of learning Spanish", "wishlist: mechanical keyboard").
   - NEVER categorize uncompleted desires or wishlists as 'Milestone_HardWork'!

3. 'Hard_Truth' (life_texture: 'hard_truth'):
   - For setbacks, financial losses, trading losses, paid bills, big expenses, failures, and emotionally difficult days (e.g., "yesterday was worst day I lost massively in options", "lost 15k trading", "paid wifi bill 800", "bought groceries for 1200", "failed the mock test").
   - Financial losses, bills, and expenses are NEVER 'Milestone_HardWork'!

4. 'Milestone_HardWork' (life_texture: 'hard_work'):
   - STRICT RULE: ONLY for difficult, fully COMPLETED past actions and real achievements (e.g., "finished my resume update", "submitted the final thesis", "shipped auth module v2", "hit 100 pull-ups target").
   - NEVER use this for future intentions, wishlists, chores, bills, or media!

5. 'Quiet_Moment' (life_texture: 'quiet_moment'):
   - For genuine past micro-moments of peace, quiet evening walks, heartfelt conversations with loved ones, small tranquil joys, and serendipities. (NOT pop songs or movie trailers—those are Media_Log!).

6. 'Perspective_Lesson' (life_texture: 'perspective'):
   - For wisdom gained from books, philosophical thoughts, mindset realizations, and personal lessons.

7. 'Task' / 'Reminder' / 'Event' (life_texture: 'actionable_obligation'):
   - If the text describes an upcoming task, call, meeting, appointment, deadline, or scheduled event (e.g., "call today Rohit at 4 PM", "upcoming MBA event on Oct 13", "dentist appointment tomorrow at 10am"):
     * Set 'is_future_actionable: true'
     * Set 'category' as 'Task', 'Reminder', or 'Event'
     * Set 'life_texture' as 'actionable_obligation'
     * Set 'calendar_action.is_actionable: true' with computed start_time and end_time.
   - If it is not a scheduled time-bound obligation, set 'is_future_actionable: false' and 'calendar_action.is_actionable: false'.

CRITICAL "PASTE AND SPLIT" PROTOCOL:
- When a user inputs a wall of text, multiple sentences, bullet points, numbered lines, or disjointed thoughts, you MUST NEVER treat it as one single lump thought.
- You MUST slice and split the input into separate, individual atomic items in the output array.
- For EACH item sliced, execute strict categorization.

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
    "gemini-flash-latest",
    "gemini-3.8-flash",
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


