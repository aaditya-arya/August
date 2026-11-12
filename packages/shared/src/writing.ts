export const writingModes = [
  {
    name: "Free write", title: "Let the day unfold.",
    placeholder: "Today, I keep coming back to…",
    prompts: ["What’s one small moment from today you’d like to keep?", "What’s taking up space in your mind right now?", "If today were a little story, where would it begin?"],
  },
  {
    name: "Little joys", title: "Stay with the good things.",
    placeholder: "Something small that made today better…",
    prompts: ["What felt ordinary at the time, but lovely looking back?", "Who made your day a little lighter?", "What’s something you’re learning to appreciate?"],
  },
  {
    name: "Let it out", title: "You can put it down here.",
    placeholder: "If I’m being honest with myself…",
    prompts: ["What do you wish you could say without having to explain it?", "What’s one thing you don’t need to figure out tonight?", "What would you say to a friend who felt the way you do?"],
  },
  {
    name: "Dream a little", title: "Leave room for possibility.",
    placeholder: "I’d love to make a little more room for…",
    prompts: ["What would you try if you didn’t have to be good at it?", "What would a lovely, ordinary day look like a year from now?", "What’s a small first step toward something you want?"],
  },
] as const;
