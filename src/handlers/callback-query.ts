import { Composer } from "grammy";

import {
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";
import { redis } from "../config/redis";
import { createGameKeyboard, redisGameSchema, startGame } from "../core/game";
import { getLeaderboardScores } from "../services/get-leaderboard-score";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { formatLeaderboardMessage } from "../util/format-leaderboard-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { resolveDifficulty } from "../util/resolve-difficulty";

const composer = new Composer();

composer.on("callback_query:data", async (ctx) => {
  if (!ctx.chat) return;

  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  if (callbackData.startsWith("difficulty_")) {
    const difficultyStr = callbackData.replace("difficulty_", "");
    const selectedLevel = resolveDifficulty(difficultyStr);

    if (!selectedLevel) {
      return await ctx.answerCallbackQuery({
        text: `❌ Invalid difficulty. Use: easy, medium, hard, extreme, or random`,
        show_alert: true,
      });
    }

    await ctx.answerCallbackQuery(`Starting ${selectedLevel} game...`);
    return await startGame(ctx, chatId, selectedLevel);
  } else if (callbackData.startsWith("leaderboard")) {
    const [, searchKey, timeKey] = ctx.callbackQuery.data.split(" ");
    if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
      return await ctx.answerCallbackQuery({ text: "Invalid action." });
    if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
      return await ctx.answerCallbackQuery({ text: "Invalid action." });
    if (!ctx.chat)
      return await ctx.answerCallbackQuery({ text: "Invalid action." });

    const memberScores = await getLeaderboardScores({
      chatId: chatId.toString(),
      searchKey: searchKey as AllowedChatSearchKey,
      timeKey: timeKey as AllowedChatTimeKey,
    });

    const keyboard = generateLeaderboardKeyboard(
      searchKey as AllowedChatSearchKey,
      timeKey as AllowedChatTimeKey,
    );

    return await ctx
      .editMessageText(
        formatLeaderboardMessage(
          memberScores,
          searchKey as AllowedChatSearchKey,
        ),
        {
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
          parse_mode: "HTML",
        },
      )
      .catch(console.error);
  }

  const data = await redis.get(`game:${chatId}`);
  const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

  if (!existingGame || !existingGame.success) {
    return await ctx.answerCallbackQuery({
      text: "No active game found. Start a new game with /newhush",
      show_alert: true,
    });
  }

  if (callbackData === "reveal_hint") {
    const currentIndex = existingGame.data.currentHintIndex;
    if (currentIndex >= existingGame.data.hints.length - 1) {
      return await ctx.answerCallbackQuery({
        text: "No more hints available.",
        show_alert: true,
      });
    }

    const nextHintIndex = currentIndex + 1;
    await redis.set(
      `game:${chatId}`,
      JSON.stringify({
        ...existingGame.data,
        currentHintIndex: nextHintIndex,
      }),
    );

    await ctx.reply(
      `<b>Hint ${nextHintIndex + 1}:</b> ${
        existingGame.data.hints[nextHintIndex]
      }`,
      { parse_mode: "HTML", reply_markup: createGameKeyboard() },
    );

    return await ctx.answerCallbackQuery(`Hint ${nextHintIndex + 1} revealed!`);
  } else if (callbackData === "show_all_hints") {
    const revealedHints = existingGame.data.hints.slice(
      0,
      existingGame.data.currentHintIndex + 1,
    );

    await ctx.reply(
      `<blockquote>All Hints Revealed:</blockquote>\n\n${revealedHints
        .map((hint, index) => `${index + 1}: ${hint}`)
        .join("\n")}`,
      { parse_mode: "HTML", reply_markup: createGameKeyboard() },
    );

    return await ctx.answerCallbackQuery("All revealed hints shown!");
  }

  await ctx.answerCallbackQuery({ text: "Invalid action." });
});

export const callbackQueryHandler = composer;
