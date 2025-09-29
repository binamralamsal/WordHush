import { sql } from "kysely";
import z from "zod";

import { SYSTEM_PROMPT } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import type { DifficultyLevels } from "../types";
import { APIKeyManager } from "../util/key-manager";

const keyManager = new APIKeyManager();

keyManager.initialize();

const FREE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const hintsSchema = z.object({
  words: z.array(z.string()),
  hints: z.array(z.string()),
  sentence: z.string(),
});

export async function getWordWithHints(
  randomWord: string,
  level: DifficultyLevels,
) {
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

  // Comment lines below if all words don't have hints in database.
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
}

export async function getAndStoreHintsFromAI(
  level: DifficultyLevels,
  randomWord: string,
  maxRetries: number = env.GEMINI_API_KEYS.length * FREE_MODELS.length * 2,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { genAI } = await keyManager.getWorkingKey();

      const modelIndex = (attempt - 1) % FREE_MODELS.length;
      const modelName = FREE_MODELS[modelIndex];
      if (!modelName) continue;

      const ai = genAI.getGenerativeModel({ model: modelName });

      const prompt = `${SYSTEM_PROMPT}

**THE WORD TO CREATE HINTS FOR:** ${randomWord}
**DIFFICULTY LEVEL:** ${level}

Create hints for the word "${randomWord}" at ${level} difficulty level.`;
      const result = await ai.generateContent(prompt);

      let text = result.response.text();
      text = text.replace(/```json|```/g, "").trim();

      const parsed = JSON.parse(text);
      const validated = hintsSchema.parse(parsed);

      await db
        .insertInto("wordHints")
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
