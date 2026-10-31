export type MemorySource = { version: 1; title: string; recorded_at: string; spans: Array<{ start: number; end: number }> };
export type SourceBlock = { id: string; text: string; start: number; end: number; recorded_at: string };
export type SourceChunk = { blocks: SourceBlock[]; before: string; after: string };

function localTimestamp(year: number, month: number, day: number, hour: number, minute: number, timezone: string): string {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(target);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error("The pasted message contains an invalid date or time.");
  let value = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = formatter.formatToParts(new Date(value));
    const part = (type: string) => Number(parts.find((entry) => entry.type === type)!.value);
    const actual = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    if (actual === target) return new Date(value).toISOString();
    value += target - actual;
  }
  throw new Error("The pasted message contains an invalid local timestamp.");
}

/** Offsets always refer to the untouched original note, including its headers. */
export function sourceBlocks(text: string, reference: string, timezone: string): SourceBlock[] {
  const headers = [...text.matchAll(/^[\t \u200e]*\[(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?,\s*(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\][\t ]+[^\n:]+:[\t ]*/gim)];
  const blocks: SourceBlock[] = [];
  function add(start: number, end: number, recorded_at: string) {
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (start === end || /^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}$/.test(text.slice(start, end))) return;
    // Bound extremely long paragraphs without changing a single character or offset.
    while (end - start > 4000) {
      let cut = text.lastIndexOf(" ", start + 4000);
      if (cut <= start) cut = start + 4000;
      blocks.push({ id: `b${blocks.length + 1}`, text: text.slice(start, cut), start, end: cut, recorded_at });
      start = cut;
      while (start < end && /\s/.test(text[start])) start++;
    }
    blocks.push({ id: `b${blocks.length + 1}`, text: text.slice(start, end), start, end, recorded_at });
  }
  if (headers.length) {
    if (headers[0].index! > 0) add(0, headers[0].index!, reference);
    headers.forEach((match, index) => {
      let hour = Number(match[1]);
      if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === "pm" ? 12 : 0);
      const year = Number(match[6]) + (match[6].length === 2 ? 2000 : 0);
      const time = localTimestamp(year, Number(match[5]), Number(match[4]), hour, Number(match[2]), timezone);
      add(match.index! + match[0].length, headers[index + 1]?.index ?? text.length, time);
    });
  } else {
    const paragraphs = /[^\n]+(?:\n(?!\s*\n|\s*\d+[.)]\s)[^\n]+)*/g;
    for (const match of text.matchAll(paragraphs)) add(match.index!, match.index! + match[0].length, reference);
  }
  return blocks;
}

export function sourceChunks(blocks: SourceBlock[]): SourceChunk[] {
  const groups: SourceBlock[][] = [];
  for (const block of blocks) {
    const group = groups[groups.length - 1];
    const sceneBreak = group && Date.parse(block.recorded_at) - Date.parse(group[group.length - 1].recorded_at) > 90 * 60000;
    if (!group || sceneBreak || group.reduce((size, item) => size + item.text.length, 0) + block.text.length > 6500 || group.length >= 14) groups.push([block]);
    else group.push(block);
  }
  return groups.map((group, index) => ({ blocks: group,
    before: groups[index - 1]?.slice(-2).map((block) => block.text).join("\n").slice(-1000) || "",
    after: groups[index + 1]?.slice(0, 2).map((block) => block.text).join("\n").slice(0, 1000) || "" }));
}

/** Models select passages. They never write the content we store as someone's words. */
export function groundExtraction(value: unknown, blocks: SourceBlock[]) {
  const raw = value as { items?: Array<Record<string, unknown>> };
  if (!raw || !Array.isArray(raw.items) || !raw.items.length) throw new Error("No source-backed memories were returned.");
  const used: Array<{ start: number; end: number }> = [];
  const items = raw.items.map((item) => {
    if (!item || typeof item !== "object") throw new Error("A source-backed memory is invalid.");
    let spans = item.source_spans as Array<{ block_id: string; start_quote?: string | null; end_quote?: string | null }> | undefined;
    // Compatibility for old providers/tests: only an exact, unambiguous source quote is accepted.
    if (!spans && typeof item.content === "string") {
      const quote = item.content.trim();
      const matches = blocks.filter((block) => block.text.includes(quote));
      if (quote && matches.length === 1 && matches[0].text.indexOf(quote) === matches[0].text.lastIndexOf(quote)) spans = [{ block_id: matches[0].id, start_quote: quote, end_quote: quote }];
    }
    if (!Array.isArray(spans) || !spans.length || spans.length > 20) throw new Error("A memory is missing verifiable source passages.");
    const selected = spans.map((span) => {
      const block = blocks.find((entry) => entry.id === span.block_id);
      if (!block) throw new Error("A memory referred to a missing source block.");
      const first = span.start_quote, last = span.end_quote;
      let start = 0, end = block.text.length;
      if (first || last) {
        if (typeof first !== "string" || typeof last !== "string" || !first || !last) throw new Error("Both exact passage anchors are required.");
        start = block.text.indexOf(first);
        const finish = first === last ? start : block.text.indexOf(last, start + first.length);
        if (start < 0 || finish < 0 || block.text.lastIndexOf(first) !== start || (first !== last && block.text.lastIndexOf(last) !== finish)) throw new Error("A memory's source anchors were changed or ambiguous.");
        end = finish + last.length;
      }
      return { start: block.start + start, end: block.start + end, text: block.text.slice(start, end), recorded_at: block.recorded_at };
    }).sort((a, b) => a.start - b.start);
    for (const span of selected) {
      if (used.some((previous) => Math.min(previous.end, span.end) - Math.max(previous.start, span.start) > 20)) throw new Error("Extraction duplicated the same passage into different memories.");
      used.push(span);
    }
    const memory: MemorySource = { version: 1, title: typeof item.title === "string" ? item.title.trim().slice(0, 120) : "", recorded_at: selected[0].recorded_at, spans: selected.map(({ start, end }) => ({ start, end })) };
    const action = item.calendar_action as { is_actionable?: boolean } | undefined;
    return { ...item, content: selected.map((span) => span.text).join("\n\n"), event_timestamp: action?.is_actionable ? item.event_timestamp : memory.recorded_at, memory };
  });
  // Quiet scenes and connective passages cannot disappear because the model preferred tasks.
  for (const block of blocks.filter((entry) => entry.text.length >= 40)) {
    const covered = used.reduce((sum, span) => sum + Math.max(0, Math.min(span.end, block.end) - Math.max(span.start, block.start)), 0);
    if (covered / block.text.length < .8) throw new Error(`Extraction left source block ${block.id} without enough context.`);
  }
  return items;
}

export function memorySource(value: unknown): MemorySource | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<MemorySource>;
  if (item.version !== 1 || typeof item.title !== "string" || typeof item.recorded_at !== "string" || !Number.isFinite(Date.parse(item.recorded_at)) || !Array.isArray(item.spans) || !item.spans.length || item.spans.some((span) => !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start)) return null;
  return item as MemorySource;
}
