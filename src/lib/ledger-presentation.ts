import { BookOpen, Calendar, CheckCircle2, Coffee, Headphones, Quote, Sparkle, TrendingDown, NotebookPen, CircleHelp, Heart, Folder } from "lucide-react";
import { getClassification, type LifeTexture } from "./ledger";

const PRESENTATION = {
  actionable_obligation: { label: "Tasks & Events", icon: Calendar, bgAccent: "bg-sky-500", borderClass: "border-sky-300/80 dark:border-sky-500/35", textAccent: "text-sky-900 dark:text-sky-100 bg-sky-100/90 dark:bg-sky-500/15" },
  hard_truth: { label: "Hard Truth & Cost", icon: TrendingDown, bgAccent: "bg-amber-500", borderClass: "border-amber-300/80 dark:border-amber-500/35", textAccent: "text-amber-900 dark:text-amber-100 bg-amber-100/90 dark:bg-amber-500/15" },
  media_log: { label: "Media & Intake", icon: Headphones, bgAccent: "bg-indigo-600", borderClass: "border-indigo-400/60", textAccent: "text-indigo-900 dark:text-indigo-100 bg-indigo-100/90 dark:bg-indigo-500/15" },
  idea_spark: { label: "Idea", icon: Sparkle, bgAccent: "bg-violet-500", borderClass: "border-violet-300/80 dark:border-violet-500/35", textAccent: "text-violet-900 dark:text-violet-100 bg-violet-100/90 dark:bg-violet-500/15" },
  wishlist: { label: "Wishlist", icon: Heart, bgAccent: "bg-violet-500", borderClass: "border-violet-300/80 dark:border-violet-500/35", textAccent: "text-violet-900 dark:text-violet-100 bg-violet-100/90 dark:bg-violet-500/15" },
  custom: { label: "", icon: Folder, bgAccent: "bg-accent", borderClass: "border-border", textAccent: "text-foreground bg-accent/5" },
  perspective: { label: "Perspective & Insight", icon: BookOpen, bgAccent: "bg-rose-500", borderClass: "border-rose-300/80 dark:border-rose-500/35", textAccent: "text-rose-900 dark:text-rose-100 bg-rose-100/90 dark:bg-rose-500/15" },
  hard_work: { label: "Milestone & Achievement", icon: CheckCircle2, bgAccent: "bg-emerald-500", borderClass: "border-emerald-300/80 dark:border-emerald-500/35", textAccent: "text-emerald-900 dark:text-emerald-100 bg-emerald-100/90 dark:bg-emerald-500/15" },
  quiet_moment: { label: "Quiet Moment", icon: Coffee, bgAccent: "bg-purple-500", borderClass: "border-purple-300/80 dark:border-purple-500/35", textAccent: "text-purple-900 dark:text-purple-100 bg-purple-100/90 dark:bg-purple-500/15" },
  shaairi_quote: { label: "Shaairi & Quote", icon: Quote, bgAccent: "bg-purple-500", borderClass: "border-purple-300/80 dark:border-purple-500/35", textAccent: "text-purple-900 dark:text-purple-100 bg-purple-100/90 dark:bg-purple-500/15" },
  daily_log: { label: "Daily Life", icon: NotebookPen, bgAccent: "bg-zinc-500", borderClass: "border-border", textAccent: "text-foreground bg-surface" },
  unclassified: { label: "Unclassified", icon: CircleHelp, bgAccent: "bg-zinc-400", borderClass: "border-border", textAccent: "text-foreground bg-surface" },
} satisfies Record<LifeTexture, object>;

export function resolveLifeTexture(item: { category: string }) {
  const { category, texture, label: categoryLabel, color } = getClassification(item);
  const style = PRESENTATION[texture];
  const label = category === "Task" ? "Task" : category === "Reminder" ? "Reminder" : category === "Event" ? "Event" : categoryLabel;
  return { key: texture, ...style, label, color };
}
