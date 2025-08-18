import z from "zod";
import { ai } from "../config/ai";
import { SYSTEM_PROMPT } from "../config/constants";
import words from "../data/words.json";
import type { DifficultyLevels } from "../types";
import { WordSelector } from "../util/word-selector";

const levelMap = {
  easy: ["A1", "A2"],
  medium: ["B1"],
  hard: ["B2"],
  extreme: ["C1", "C2"],
} as const;

const hintsSchema = z.object({
  words: z.array(z.string()),
  hints: z.array(z.string()),
});

export async function getWordWithHints(
  level: DifficultyLevels,
  chatId: number
) {
  // const cefrLevels = levelMap[level];
  // const filteredWords = cefrLevels.flatMap((level) => {
  //   const val = words[level];
  //   if (Array.isArray(val)) return val;
  //   return [];
  // });

  // if (!filteredWords.length) return null;

  // const randomWord =
  //   filteredWords[Math.floor(Math.random() * filteredWords.length)];
  // if (!randomWord) return null;

  const wordSelector = new WordSelector({ level });
  const randomWord = await wordSelector.getRandomWord(chatId);

  const prompt = `${SYSTEM_PROMPT}\n\nLevel: ${level}\nWord: ${randomWord}`;

  const result = await ai.generateContent(prompt);
  let text = result.response.text();

  text = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(text);
    return hintsSchema.parse(parsed);
  } catch (e) {
    console.error("Invalid JSON from model:", text);
    return null;
  }
}
