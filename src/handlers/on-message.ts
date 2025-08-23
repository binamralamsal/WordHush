import { Composer, Context, GrammyError } from "grammy";
import type { ReactionTypeEmoji } from "grammy/types";

import { sql } from "kysely";

import { db } from "../config/db";
import { redis } from "../config/redis";
import { calculateScore, redisGameSchema } from "../core/game";

const composer = new Composer();

composer.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userGuess = ctx.message.text.trim().toLowerCase();
  const name = `${ctx.from.first_name}${
    ctx.from.last_name ? " " + ctx.from.last_name : ""
  }`;
  const username = ctx.from.username;
  const userId = ctx.from.id.toString();

  const data = await redis.get(`game:${chatId}`);
  const gameState = data ? redisGameSchema.safeParse(JSON.parse(data)) : null;

  if (!gameState || !gameState.success) return;

  await redis.set(`msg:${chatId}`, ctx.msgId);

  if (userGuess.startsWith("/")) return;

  const level = gameState.data.level;

  const correctGuess = gameState.data.words.some(
    (word) => word.toLowerCase() === userGuess,
  );

  if (correctGuess) {
    const score = calculateScore(level, gameState.data.currentHintIndex - 1);

    const user = await db
      .insertInto("users")
      .values({ name, username, id: userId, coins: score })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          name: name,
          username: username || null,
          coins: sql`users.coins + EXCLUDED.coins`,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    await db
      .insertInto("leaderboard")
      .values({
        score,
        chatId: chatId.toString(),
        level,
        userId: user.id,
      })
      .execute();

    ctx.reply(
      `<blockquote><b>🎉 Congratulations! You guessed it right + ${score} 🏵</b></blockquote>

<blockquote><b>Word:</b> ${userGuess}
<b>All possible forms:</b> ${gameState.data.words.join(", ")}
Added ${score} points to the leaderboard.
<b>Example:</b> ${gameState.data.sentence}</blockquote>

Start a new game with /newhush`,
      { parse_mode: "HTML", reply_parameters: { message_id: ctx.msgId } },
    );

    reactWithRandom(ctx);
    return await redis.del(`game:${chatId}`);
  } else if (isGuessSimilar(userGuess, gameState.data.words)) {
    ctx.reply("🔥 You're close! Try again or get more hints.", {
      reply_parameters: { message_id: ctx.msgId },
    });
  }
});

async function reactWithRandom(ctx: Context) {
  const emojis: ReactionTypeEmoji["emoji"][] = [
    "🎉",
    "🏆",
    "🤩",
    "⚡",
    "🫡",
    "💯",
    "❤‍🔥",
    "🦄",
  ];

  const shuffled = emojis.sort(() => Math.random() - 0.5);

  for (const emoji of shuffled) {
    try {
      await ctx.react(emoji);
      return;
    } catch (err) {
      if (
        err instanceof GrammyError &&
        err.description?.includes("REACTION_NOT_ALLOWED")
      ) {
        continue;
      } else {
        break;
      }
    }
  }
}

export const onMessageHander = composer;

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );

  // @ts-expect-error - shut up
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  // @ts-expect-error - shut up
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        // @ts-expect-error - shut up
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // @ts-expect-error - shut up
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  // @ts-expect-error - shut up
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen; // normalized similarity (0–1)
}

function isGuessSimilar(
  guess: string,
  targetWords: string[],
  threshold: number = 0.7,
): boolean {
  for (const target of targetWords) {
    if (similarity(guess, target) >= threshold) {
      return true;
    }
  }
  return false;
}
