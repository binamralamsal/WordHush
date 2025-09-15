import { sql } from "kysely";
import z from "zod";

import { SYSTEM_PROMPT } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import type { DifficultyLevels } from "../types";
import { APIKeyManager } from "../util/key-manager";
import { WordSelector } from "../util/word-selector";

const keyManager = new APIKeyManager();

keyManager.initialize();

const hintsSchema = z.object({
  words: z.array(z.string()),
  hints: z.array(z.string()),
  sentence: z.string(),
});
export async function getWordWithHints(
  level: DifficultyLevels,
  chatId: number,
  maxRetries: number = env.GEMINI_API_KEYS.length * 2,
) {
  let lastError: Error | null = null;

  const wordSelector = new WordSelector({ level });
  const randomWord = await wordSelector.getRandomWord(chatId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { genAI } = await keyManager.getWorkingKey();
      const ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `${SYSTEM_PROMPT}\n\nLevel: ${level}\nWord: ${randomWord}`;

      const result = await ai.generateContent(prompt);
      let text = result.response.text();
      text = text.replace(/```json|```/g, "").trim();

      const parsed = JSON.parse(text);
      const validated = hintsSchema.parse(parsed);

      db.insertInto("wordHints")
        .values({
          hints: validated.hints,
          relatedWords: validated.words,
          level,
          sentence: validated.sentence,
          word: randomWord,
        })
        .execute();

      return { ...validated, randomWord };
    } catch (error) {
      lastError = error as Error;
      const { key } = await keyManager.getWorkingKey();

      if (isAPIKeyError(error as Error)) {
        await keyManager.markKeyAsFailed(key);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (attempt === maxRetries || keyManager.getAvailableKeysCount() === 0) {
        break;
      }
    }
  }

  const result1 = await db
    .selectFrom("wordHints")
    .selectAll()
    .where("level", "=", level)
    .where("word", "=", randomWord)
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .executeTakeFirst();

  if (result1) {
    return {
      words: result1.relatedWords,
      hints: result1.hints,
      sentence: result1.sentence,
      randomWord: result1.word,
    };
  }

  const result2 = await db
    .selectFrom("wordHints")
    .selectAll()
    .where("level", "=", level)
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .executeTakeFirst();

  if (result2) {
    return {
      words: result2.relatedWords,
      hints: result2.hints,
      sentence: result2.sentence,
      randomWord: result2.word,
    };
  }

  throw new Error(
    `Failed to get response after ${maxRetries} attempts. Last error: ${lastError?.message}`,
  );
}

function isAPIKeyError(error: Error): boolean {
  const errorStr = error.toString().toLowerCase();
  const apiKeyErrorPatterns = [
    "api key",
    "unauthorized",
    "invalid key",
    "quota exceeded",
    "rate limit",
    "forbidden",
    "401",
    "403",
    "429",
  ];

  return apiKeyErrorPatterns.some((pattern) => errorStr.includes(pattern));
}
