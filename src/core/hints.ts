import z from "zod";

import { ai } from "../config/ai";
import { SYSTEM_PROMPT } from "../config/constants";
import type { DifficultyLevels } from "../types";
import { WordSelector } from "../util/word-selector";

const hintsSchema = z.object({
  words: z.array(z.string()),
  hints: z.array(z.string()),
});

export async function getWordWithHints(
  level: DifficultyLevels,
  chatId: number,
) {
  const wordSelector = new WordSelector({ level });
  const randomWord = await wordSelector.getRandomWord(chatId);

  const prompt = `${SYSTEM_PROMPT}\n\nLevel: ${level}\nWord: ${randomWord}`;

  const result = await ai.generateContent(prompt);
  let text = result.response.text();

  text = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(text);
    return hintsSchema.parse(parsed);
  } catch {
    console.error("Invalid JSON from model:", text);
    return null;
  }
}
