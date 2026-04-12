import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(dateString));
}

export function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function clampScore(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function simpleKeywordOverlap(text: string, query: string) {
  const source = new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .reduce((score, word) => score + (source.has(word) ? 1 : 0), 0);
}
