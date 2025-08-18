import { type Context, InlineKeyboard } from "grammy";

import z from "zod";

import { redis } from "../config/redis";
import type { DifficultyLevels } from "../types";
import { getWordWithHints } from "./hints";

export function createGameKeyboard() {
  return new InlineKeyboard()
    .text("Reveal new hint", "reveal_hint")
    .text("Show all hints", "show_all_hints");
}

export const redisGameSchema = z.object({
  words: z.array(z.string()),
  hints: z.array(z.string()),
  currentHintIndex: z.number().default(0),
});

export async function startGame(
  ctx: Context,
  chatId: number,
  level: DifficultyLevels,
) {
  const data = await redis.get(`game:${chatId}`);
  if (data) {
    const existingGame = redisGameSchema.safeParse(JSON.parse(data));
    if (existingGame.success) {
      return await ctx.reply(
        "A game is already in progress. Please finish it before starting a new one.",
      );
    } else {
      console.error("Invalid game data in Redis:", existingGame.error);
    }
  }

  try {
    const generatingMessage = await ctx.reply("🤖 Generating AI Hints...");

    const data = await getWordWithHints(level, chatId);

    if (!data || data.hints.length === 0) {
      return await ctx.api.editMessageText(
        chatId,
        generatingMessage.message_id,
        "Failed to generate word hints. Please try again.",
      );
    }

    console.log(data.words);

    await redis.set(
      `game:${chatId}`,
      JSON.stringify({
        words: data.words,
        hints: data.hints,
        currentHintIndex: 0,
      }),
    );

    await ctx.api.editMessageText(
      chatId,
      generatingMessage.message_id,
      `<blockquote>${
        level.charAt(0).toUpperCase() + level.slice(1)
      } Word Game Started!</blockquote>
      
<b>Hint 1:</b> ${data.hints[0]}`,
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
