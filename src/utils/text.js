/** Splits on commas and semicolons that are not inside brackets: "A (x, y), B; C" → ["A (x, y)", "B", "C"] */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.replace(/\s+/g, " ").trim().replace(/\.$/, "")).filter(Boolean);
}

// A syllabus written as outcomes ("Explain …. Analyze …. Compare …") is prose, not a topic list
const OUTCOME_VERB =
  /^(explain|analy[sz]e|apply|design|implement|compare|perform|utili[sz]e|conduct|manage|plan|participate|configure|provision|develop|evaluate|understand|describe|demonstrate|identify|create|build|use|learn|discuss|illustrate|solve|write|construct|assess)\b/i;

const sentencesOf = (text) =>
  text
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);

/** "Unit: topic, topic. Next unit: topic" → [{ title: "Unit", items: [...] }, ...]; text without that shape becomes plain bullets or text. */
function parseUnits(text) {
  const sentences = sentencesOf(text);
  const hasHeadings = sentences.some((s) => /^[^:,;]{2,80}?\s*:/.test(s)); // "Design High-Performing Architectures: …" is a unit heading, not an outcome
  if (!hasHeadings && sentences.length >= 2 && sentences.filter((s) => OUTCOME_VERB.test(s)).length >= 2) {
    return [{ title: "", items: sentences, text: "" }]; // one bullet per sentence; their commas stay put
  }
  return text
    .split(/\.\s*(?=[A-Z][^.:]{2,80}:)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m = chunk.match(/^([^:,;]{2,80}?)\s*:[-\s]*(.*)$/);
      const items = splitTopLevel(m ? m[2] : chunk);
      const title = m ? m[1] : "";
      return items.length > 1 ? { title, items, text: "" } : { title, items: [], text: items[0] || "" };
    });
}

// "CO-1:-", "CO1:", "CO-3 " … each one starts a block that runs until the next one
const CO_MARK = /\bCO[\s-]?(\d{1,2})(?=[\s:-])\s*[:-]*/gi;

/**
 * The ERP gives a syllabus as one long string. With CO markers, everything between two markers is one block
 * ({ title: "CO-1", subs: [units] }); without them it is split into its units.
 */
export function parseSyllabus(text) {
  const flat = (text || "").replace(/\uFFFD/g, " – ").replace(/\s+/g, " ").trim();
  if (!flat) return [];

  const marks = [...flat.matchAll(CO_MARK)];
  if (marks.length === 0) return parseUnits(flat);

  const blocks = [];
  const lead = flat.slice(0, marks[0].index).replace(/^syllabus\s*:?/i, "").trim();
  if (lead) blocks.push(...parseUnits(lead));

  const roadmap = []; // "CO-1 (SOA Foundations) → CO-2 (Security) → …" is an overview line, not content
  const content = [];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : flat.length;
    const body = flat.slice(m.index + m[0].length, end).trim();
    if (!body) return;
    const label = body.match(/^\(([^)]*)\)\s*(?:→|->)?\s*\.?$/);
    if (label) roadmap.push(`CO-${m[1]} · ${label[1].trim()}`);
    else content.push({ title: `CO-${m[1]}`, items: [], text: "", subs: parseUnits(body) });
  });
  if (roadmap.length > 0) blocks.push({ title: "Course map", items: roadmap, text: "" });
  blocks.push(...content);
  return blocks;
}

const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to", "with", "a", "an", "on"]);

/** "DATA STRUCTURES AND ALGORITHMS" → "Data Structures and Algorithms" */
export function titleCase(text) {
  return (text || "")
    .split(/\s+/)
    .map((raw, index) => {
      if (raw.startsWith("(")) return raw; // short codes in brackets, like (CNAD), stay as ERP wrote them
      const word = raw.toLowerCase();
      return index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
