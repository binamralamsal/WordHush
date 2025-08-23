import { type Context, InlineKeyboard } from "grammy";

import z from "zod";

import { difficultyLevels } from "../config/constants";
import { redis } from "../config/redis";
import type { DifficultyLevels } from "../types";
import { getWordWithHints } from "./hints";

export function createGameKeyboard(noReveal = false) {
  const inlineKeyboard = new InlineKeyboard().text(
    "💡 Reveal new hint",
    "reveal_hint",
  );

  if (!noReveal) {
    inlineKeyboard.text("🔠 Reveal a letter (-2 🏵)", "reveal_letter");
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
});

export async function startGame(
  ctx: Context,
  chatId: number,
  level: DifficultyLevels,
  isCallback = false,
) {
  const data = await redis.get(`game:${chatId}`);
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
      const sentMessage = await ctx.reply("🤖 Generating AI Hints...");
      messageIdToEdit = sentMessage.message_id;
    }

    const data = await getWordWithHints(level, chatId);

    if (!data || data.hints.length === 0) {
      return await ctx.api.editMessageText(
        chatId,
        messageIdToEdit,
        "Failed to generate word hints. Please try again.",
      );
    }

    await redis.set(
      `game:${chatId}`,
      JSON.stringify({
        words: data.words,
        hints: data.hints,
        sentence: data.sentence,
        currentHintIndex: 1,
        level,
      }),
    );

    await ctx.api.editMessageText(
      chatId,
      messageIdToEdit,
      `<blockquote>${
        level.charAt(0).toUpperCase() + level.slice(1)
      } Word Game Started!</blockquote>
<b>1:</b> ${data.hints[0]}`,
      {
        parse_mode: "HTML",
        reply_markup: createGameKeyboard(),
      },
    );
  } catch (error) {
    console.error("Error starting game:", error);
    ctx.reply("An error occurred while starting the game. Please try again.");
  }
}
