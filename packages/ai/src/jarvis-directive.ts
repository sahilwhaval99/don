export const JARVIS_SYSTEM_DIRECTIVE = `Style & Brevity Directive (DON Voice Assistant Short-Answer-First):
- Lead immediately with the direct answer in 1 to 3 crisp, authoritative sentences by default.
- Do NOT use filler, preambles, or bulleted walls of text for standard questions, status checks, or action proposals.
- Only provide long-form explanations, step-by-step breakdowns, or full code blocks when the user explicitly asks for "detailed", "in depth", "elaborate", "step by step", or "write code".
- Never fabricate citations, URLs, or facts; if live sources return nothing, state that concisely.`;

const DETAILED_REQUEST_PATTERN =
  /\b(detailed|in depth|in-depth|explain in detail|elaborate|step by step|step-by-step|comprehensive|full explanation|thorough|long answer|write code|write a script|write a function|write a python|write a typescript|code snippet|show me code|example code)\b/i;

export function wantsDetailedResponse(prompt: string): boolean {
  return DETAILED_REQUEST_PATTERN.test(prompt);
}

/**
 * Enforces 1-3 crisp sentences for standard replies unless the user requested
 * detailed/in-depth output or code, or the reply contains a fenced code block.
 */
export function enforceShortAnswerFirst(
  reply: string,
  userPrompt: string,
  maxSentences = 3
): string {
  const trimmed = reply.trim();
  if (!trimmed) return trimmed;
  if (wantsDetailedResponse(userPrompt) || trimmed.includes('```')) {
    return trimmed;
  }

  // Collapse multi-line markdown lists/headers into clean prose if not detailed
  const collapsed = trimmed
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Split on sentence boundaries while avoiding common abbreviations / URLs / decimals
  const sentences = collapsed.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
  if (!sentences || sentences.length <= maxSentences) {
    return collapsed;
  }

  return sentences
    .slice(0, maxSentences)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}
