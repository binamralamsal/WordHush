import { type Context, InlineKeyboard } from "grammy";

import z from "zod";

import { difficultyLevels } from "../config/constants";
import { REDIS_PREFIX, redis } from "../config/redis";
import type { DifficultyLevels } from "../types";
import { WordSelector } from "../util/word-selector";
import { getAndStoreHintsFromAI, getWordWithHints } from "./hints";

export function calculateRevealPrice(level: DifficultyLevels) {
  return level === "easy"
    ? 2
    : level === "medium"
      ? 4
      : level === "hard"
        ? 6
        : 8;
}

export function calculateScore(level: DifficultyLevels, hintsUsed: number) {
  const baseScore =
    level === "easy" ? 5 : level === "medium" ? 10 : level === "hard" ? 20 : 30;

  const penaltyPerHint =
    level === "easy"
      ? 0.25
      : level === "medium"
        ? 0.5
        : level === "hard"
          ? 0.75
          : 1;

  const maxDeduction = baseScore * (level === "easy" ? 0.3 : 0.4);

  const scoreDeduction = Math.min(hintsUsed * penaltyPerHint, maxDeduction);

  return Math.max(Math.round(baseScore - scoreDeduction), 1);
}

export function createGameKeyboard({
  noReveal = false,
  level,
}: {
  noReveal?: boolean;
  level: DifficultyLevels;
}) {
  const inlineKeyboard = new InlineKeyboard().text(
    "💡 Reveal new hint",
    "reveal_hint",
  );

  if (!noReveal) {
    const price = calculateRevealPrice(level);

    inlineKeyboard.text(`🔠 Reveal a letter (-${price} 🏵)`, "reveal_letter");
  }

  return inlineKeyboard;
}

export const redisGameSchema = z.object({
  words: z.array(z.string()).nonempty(),
  hints: z.array(z.string()),
  level: z.enum(difficultyLevels),
  sentence: z.string(),
  currentHintIndex: z.number().default(0),
  revealedPositions: z.array(z.number()).default([]),
  startedBy: z.string().optional(),
});

export type GameSchema = z.infer<typeof redisGameSchema>;

export async function startGame(
  ctx: Context,
  chatId: number,
  level: DifficultyLevels,
  isCallback = false,
) {
  if (!ctx.from) return;

  const data = await redis.get(`${REDIS_PREFIX}game:${chatId}`);
  if (data) {
    const existingGame = redisGameSchema.safeParse(JSON.parse(data));
    if (existingGame.success) {
      if (isCallback) {
        return await ctx.answerCallbackQuery({
          text: "A game is already in progress. Please finish it before starting a new one.",
          show_alert: true,
        });
      } else
        return await ctx.reply(
          "A game is already in progress. Please finish it before starting a new one.",
        );
    } else {
      console.error("Invalid game data in Redis:", existingGame.error);
    }
  }

  try {
    let messageIdToEdit: number;
    if (isCallback && ctx.msgId) {
      ctx.editMessageText("🤖 Generating AI Hints...");
      messageIdToEdit = ctx.msgId;
    } else {
      const sentMessage = await ctx.reply("🤖 Generating AI Hints...", {
        protect_content: true,
      });
      messageIdToEdit = sentMessage.message_id;
    }

    let alreadyStored = false;

    // For every game, it takes data from database
    const wordSelector = new WordSelector({ level });
    const randomWord = await wordSelector.getRandomWord(chatId);

    let data = await getWordWithHints(randomWord, level);
    if (!data) {
      data = await getAndStoreHintsFromAI(level, randomWord);
      alreadyStored = true;
    }

    if (!data || data.hints.length === 0) {
      return await ctx.api.editMessageText(
        chatId,
        messageIdToEdit,
        "Failed to generate word hints. Please try again.",
      );
    }

    const operations = [];

    if (randomWord !== data.randomWord) {
      const historyKey = wordSelector.getHistoryKey(chatId);
      operations.push(
        redis.sadd(historyKey, data.randomWord),
        redis.srem(historyKey, randomWord),
      );
    }

    operations.push(
      redis.set(
        `${REDIS_PREFIX}game:${chatId}`,
        JSON.stringify({
          words: data.words,
          hints: data.hints,
          sentence: data.sentence,
          currentHintIndex: 1,
          startedBy: ctx.from.id.toString(),
          level,
        }),
      ),
    );

    await Promise.all(operations);

    await ctx.api.editMessageText(
      chatId,
      messageIdToEdit,
      `<blockquote>${
        level.charAt(0).toUpperCase() + level.slice(1)
      } Word Game Started!</blockquote>
<b>1:</b> ${data.hints[0]}`,
      {
        parse_mode: "HTML",
        reply_markup: createGameKeyboard({ level }),
      },
    );

    if (!alreadyStored) getAndStoreHintsFromAI(level, randomWord);
  } catch (error) {
    console.error("Error starting game:", error);
    ctx.reply("An error occurred while starting the game. Please try again.");
  }
}
