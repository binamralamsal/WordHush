import { Composer } from "grammy";

import { redis } from "../config/redis";
import { redisGameSchema } from "../core/game";

const composer = new Composer();

composer.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userGuess = ctx.message.text.trim().toLowerCase();

  if (userGuess.startsWith("/")) return;

  const data = await redis.get(`game:${chatId}`);
  const gameState = data ? redisGameSchema.safeParse(JSON.parse(data)) : null;

  if (!gameState || !gameState.success) return;

  const correctGuess = gameState.data.words.some(
    (word) => word.toLowerCase() === userGuess,
  );

  if (correctGuess) {
    ctx.reply(
      `<blockquote><b>🎉 Congratulations! You guessed it right</b></blockquote>

✅ The word was: <b>${userGuess}</b>
All possible forms: ${gameState.data.words.join(", ")}

Start a new game with /newhush`,
      { parse_mode: "HTML", reply_parameters: { message_id: ctx.msgId } },
    );
    return await redis.del(`game:${chatId}`);
  } else if (isCloseToWord(userGuess, gameState.data.words)) {
    ctx.reply("🔥 You're close! Try again or get more hints.", {
      reply_parameters: { message_id: ctx.msgId },
    });
  }
});

export const onMessageHander = composer;

function isCloseToWord(guess: string, targetWords: string[]): boolean {
  const normalizedGuess = guess.toLowerCase().trim();

  for (const word of targetWords) {
    const normalizedWord = word.toLowerCase();

    // Check if it's a partial match or similar
    if (
      normalizedWord.includes(normalizedGuess) ||
      normalizedGuess.includes(normalizedWord) ||
      levenshteinDistance(normalizedGuess, normalizedWord) <= 2
    ) {
      return true;
    }
  }
  return false;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;

      // @ts-expect-error - shut up
      matrix[j][i] = Math.min(
        // @ts-expect-error - shut up
        matrix[j][i - 1] + 1,
        // @ts-expect-error - shut up
        matrix[j - 1][i] + 1,
        // @ts-expect-error - shut up
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }

  // @ts-expect-error - shut up
  return matrix[str2.length][str1.length];
}
