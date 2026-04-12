import { Embeddings } from "@langchain/core/embeddings";

const DEFAULT_DIMENSIONS = 192;
const MODEL_NAME = "local-semantic-v1";

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bresponse time\b/g, "latency"],
  [/\bslow api\b/g, "latency api"],
  [/\bslow endpoint\b/g, "latency endpoint"],
  [/\bstory telling\b/g, "storytelling"],
  [/\bstar method\b/g, "story structure"],
  [/\bmeasurable result\b/g, "quantification"],
  [/\btrade off\b/g, "tradeoff"]
];

const TOKEN_CANONICALIZATION = new Map<string, string>([
  ["slowness", "latency"],
  ["slow", "latency"],
  ["faster", "latency"],
  ["speed", "latency"],
  ["speedup", "latency"],
  ["performance", "latency"],
  ["throughput", "latency"],
  ["storytelling", "story_structure"],
  ["story", "story_structure"],
  ["narrative", "story_structure"],
  ["structure", "story_structure"],
  ["star", "story_structure"],
  ["quantify", "quantification"],
  ["quantified", "quantification"],
  ["quantification", "quantification"],
  ["measurable", "quantification"],
  ["metrics", "quantification"],
  ["metric", "quantification"],
  ["numbers", "quantification"],
  ["tradeoffs", "tradeoff_reasoning"],
  ["tradeoff", "tradeoff_reasoning"],
  ["constraint", "tradeoff_reasoning"],
  ["constraints", "tradeoff_reasoning"],
  ["compromise", "tradeoff_reasoning"],
  ["balancing", "tradeoff_reasoning"],
  ["stakeholders", "stakeholder_communication"],
  ["stakeholder", "stakeholder_communication"],
  ["alignment", "stakeholder_communication"],
  ["communicate", "stakeholder_communication"],
  ["communication", "stakeholder_communication"],
  ["collaboration", "stakeholder_communication"],
  ["leadership", "leadership"],
  ["ownership", "ownership"],
  ["debugging", "debugging"],
  ["incident", "incident"],
  ["reliability", "reliability"],
  ["latency", "latency"]
]);

function hashToken(token: string, seed: number) {
  let hash = 2166136261 ^ seed;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeToken(token: string) {
  if (token.length > 4 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }

  if (token.length > 3 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }

  if (token.length > 3 && token.endsWith("es")) {
    return token.slice(0, -2);
  }

  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
}

export function canonicalizeText(text: string) {
  let normalized = text.toLowerCase();

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .map((token) => TOKEN_CANONICALIZATION.get(token) ?? token)
    .filter((token) => token.length >= 2);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function embedText(text: string, dimensions: number) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = canonicalizeText(text);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const tokenWeight =
      token.includes("_") || ["latency", "quantification", "tradeoff_reasoning"].includes(token)
        ? 1.6
        : 1;
    const slot = hashToken(token, 17) % dimensions;
    const sign = hashToken(token, 29) % 2 === 0 ? 1 : -1;
    vector[slot] += tokenWeight * sign;

    if (index < tokens.length - 1) {
      const bigram = `${token}:${tokens[index + 1]}`;
      const bigramSlot = hashToken(bigram, 43) % dimensions;
      const bigramSign = hashToken(bigram, 59) % 2 === 0 ? 1 : -1;
      vector[bigramSlot] += 0.6 * bigramSign;
    }
  }

  return normalizeVector(vector);
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export class LocalSemanticEmbeddings extends Embeddings<number[]> {
  dimensions: number;
  modelName = MODEL_NAME;

  constructor(dimensions = DEFAULT_DIMENSIONS) {
    super({});
    this.dimensions = dimensions;
  }

  async embedDocuments(documents: string[]) {
    return documents.map((document) => embedText(document, this.dimensions));
  }

  async embedQuery(document: string) {
    return embedText(document, this.dimensions);
  }
}
