const ASSESSMENT_PATTERNS = [
  /\bquiz\b/i,
  /\bexam\b/i,
  /\btest\b/i,
  /\bassessment\b/i,
  /\bmcq\b/i,
  /\bmultiple(?:\s|-)?choice\b/i,
  /\btrue(?:\s*\/\s*false|\s*or\s*false)\b/i,
  /\bpractice questions?\b/i,
  /\bpast questions?\b/i,
] as const;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isAssessmentRequest(content: string) {
  const normalized = normalizeWhitespace(content);

  if (!normalized) {
    return false;
  }

  return ASSESSMENT_PATTERNS.some((pattern) => pattern.test(normalized));
}
