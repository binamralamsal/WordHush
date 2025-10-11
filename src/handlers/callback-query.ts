import { Composer } from "grammy";

import { sql } from "kysely";
import z from "zod";

import {
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import { REDIS_PREFIX, redis } from "../config/redis";
import {
  calculateRevealPrice,
  createGameKeyboard,
  redisGameSchema,
  startGame,
} from "../core/game";
import { getLeaderboardScores } from "../services/get-leaderboard-scores";
import { getUserScores } from "../services/get-user-scores";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { createLetterHint } from "../util/create-letter-hint";
import { formatLeaderboardMessage } from "../util/format-leaderboard-message";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { resolveDifficulty } from "../util/resolve-difficulty";

const composer = new Composer();

composer.on("callback_query:data", async (ctx) => {
  if (!ctx.chat) return;

  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  condition: if (callbackData.startsWith("difficulty_")) {
    const difficultyStr = callbackData.replace("difficulty_", "");
    const selectedLevel = resolveDifficulty(difficultyStr);

    if (!selectedLevel) {
      return await ctx.answerCallbackQuery({
        text: `❌ Invalid difficulty. Use: easy, medium, hard, extreme, or random`,
        show_alert: true,
      });
    }

    await ctx.answerCallbackQuery(`Starting ${selectedLevel} game...`);
    await startGame(ctx, chatId, selectedLevel, true);
  } else if (callbackData.startsWith("leaderboard")) {
    const [, searchKey, timeKey] = ctx.callbackQuery.data.split(" ");
    if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
      break condition;
    if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
      break condition;
    if (!ctx.chat) break condition;

    const memberScores = await getLeaderboardScores({
      chatId: chatId.toString(),
      searchKey: searchKey as AllowedChatSearchKey,
      timeKey: timeKey as AllowedChatTimeKey,
    });

    const keyboard = generateLeaderboardKeyboard(
      searchKey as AllowedChatSearchKey,
      timeKey as AllowedChatTimeKey,
    );

    await ctx
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
      .catch(() => {});
  } else if (callbackData.startsWith("myscore")) {
    const [, userId, searchKey, timeKey] = ctx.callbackQuery.data.split(" ");
    if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
      break condition;
    if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
      break condition;
    if (!ctx.chat) break condition;
    if (!userId) break condition;

    const userScore = await getUserScores({
      chatId: chatId.toString(),
      userId,
      searchKey: searchKey as AllowedChatSearchKey,
      timeKey: timeKey as AllowedChatTimeKey,
    });

    if (!userScore)
      return ctx.answerCallbackQuery({
        text: "You have no scores recorded yet for this query.",
        show_alert: true,
      });

    const keyboard = generateLeaderboardKeyboard(
      searchKey as AllowedChatSearchKey,
      timeKey as AllowedChatTimeKey,
      `myscore ${Number(userId)}`,
    );

    await ctx
      .editMessageText(
        formatUserScoreMessage(userScore, searchKey as AllowedChatSearchKey),
        {
          reply_markup: keyboard,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        },
      )
      .catch(() => {});

    return await ctx.answerCallbackQuery();
  }

  condition: if (
    callbackData === "reveal_hint" ||
    callbackData === "reveal_letter" ||
    callbackData.startsWith("confirm_reveal") ||
    callbackData.startsWith("cancel_reveal")
  ) {
    const data = await redis.get(`${REDIS_PREFIX}game:${chatId}`);
    const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

    if (!ctx.msgId) return;

    if (!existingGame || !existingGame.success) {
      return await ctx.answerCallbackQuery({
        text: "No active game found. Start a new game with /newhush",
        show_alert: true,
      });
    }

    if (callbackData === "reveal_hint") {
      const rateLimitSchema = z.array(z.number());

      const currentIndex = existingGame.data.currentHintIndex;
      if (currentIndex >= existingGame.data.hints.length - 1) {
        return await ctx.answerCallbackQuery({
          text: "No more hints available.",
          show_alert: true,
        });
      }

      const userId = ctx.from.id;
      const rateLimitKey = `${REDIS_PREFIX}hint_rate_limit:${userId}`;
      const blockKey = `${REDIS_PREFIX}hint_blocked:${userId}`;

      const isBlocked = await redis.get(blockKey);
      if (isBlocked) {
        await ctx.answerCallbackQuery({
          text: "You are blocked for spamming. Please wait before requesting more hints.",
          show_alert: true,
        });
        return;
      }

      const rateLimitData = await redis.get(rateLimitKey);
      let attempts: number[] = [];

      if (rateLimitData) {
        try {
          const parsed = JSON.parse(rateLimitData);
          const validatedAttempts = rateLimitSchema.safeParse(parsed);
          attempts = validatedAttempts.success ? validatedAttempts.data : [];
        } catch {
          attempts = [];
        }
      }

      // Remove attempts older than 10 seconds
      const now = Date.now();
      attempts = attempts.filter(
        (timestamp: number) => now - timestamp < 10000,
      );

      if (!env.ADMIN_USERS.includes(ctx.from.id) && attempts.length >= 5) {
        await redis.setex(blockKey, 30, "true");

        await ctx.answerCallbackQuery({
          text: "You are not allowed for 30 seconds for spamming.",
          show_alert: true,
        });

        await ctx.reply(
          `🚫 <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "")}</a> have been blocked for 30 seconds for spamming hint requests.`,
          { parse_mode: "HTML" },
        );

        return;
      }

      attempts.push(now);

      await redis.setex(rateLimitKey, 10, JSON.stringify(attempts));

      const nextHintIndex = currentIndex + 1;
      await redis.set(
        `${REDIS_PREFIX}game:${chatId}`,
        JSON.stringify({
          ...existingGame.data,
          currentHintIndex: nextHintIndex,
        }),
      );

      const revealedHints = existingGame.data.hints.slice(0, nextHintIndex);

      const correctWord = existingGame.data.words[0];
      if (!correctWord) break condition;

      const hint =
        existingGame.data.revealedPositions.length > 0
          ? createLetterHint(correctWord, existingGame.data.revealedPositions)
          : null;

      const level = existingGame.data.level;

      const message = `<blockquote>All Hints for ${
        level.charAt(0).toUpperCase() + level.slice(1)
      } level:</blockquote>\n${hint ? `\n<b>Hint: </b><code>${hint}</code>\n\n` : ""}${revealedHints
        .map((hint, index) => `${index + 1}: ${hint}`)
        .join("\n")}`;

      const latestMsgId = await redis.get(`${REDIS_PREFIX}msg:${chatId}`);
      const inlineKeyboard = createGameKeyboard({
        noReveal: existingGame.data.revealedPositions.length >= 3,
        level: existingGame.data.level,
      });

      if (latestMsgId && parseInt(latestMsgId) - ctx.msgId > 5) {
        await ctx.reply(message, {
          parse_mode: "HTML",
          reply_markup: inlineKeyboard,
          protect_content: true,
        });

        ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      } else {
        await ctx.editMessageText(message, {
          parse_mode: "HTML",
          reply_markup: inlineKeyboard,
        });
      }

      return await ctx.answerCallbackQuery(
        `Hint ${nextHintIndex + 1} revealed!`,
      );
    } else if (callbackData === "reveal_letter") {
      await ctx.reply(
        `<a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "")}</a> Are you sure you want to reveal a letter? This costs ${calculateRevealPrice(existingGame.data.level)} coins.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Yes, reveal a letter",
                  callback_data: `confirm_reveal ${ctx.from.id}`,
                },
                {
                  text: "❌ No, cancel",
                  callback_data: `cancel_reveal ${ctx.from.id}`,
                },
              ],
            ],
          },
          parse_mode: "HTML",
        },
      );
    } else if (callbackData.startsWith("confirm_reveal")) {
      const [, userId] = callbackData.split(" ");

      if (ctx.from.id.toString() !== userId) {
        return await ctx.answerCallbackQuery({
          text: "This is not for you!",
          show_alert: true,
        });
      }

      const user = await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user || user.coins < 2) {
        return await ctx.answerCallbackQuery({
          text: "You don't have enough coins to reveal a letter.",
          show_alert: true,
        });
      }

      const correctWord = existingGame.data.words[0];
      if (!correctWord) break condition;

      const revealedPosition = existingGame.data.revealedPositions;

      if (revealedPosition.length >= 3) {
        ctx.deleteMessage();
        return await ctx.answerCallbackQuery({
          text: "You have already revealed 3 letters, cannot reveal more.",
          show_alert: true,
        });
      }

      const allPositions = Array.from(
        { length: correctWord.length },
        (_, i) => i,
      );
      const remainingPositions = allPositions.filter(
        (i) => !revealedPosition.includes(i),
      );

      if (remainingPositions.length === 0) {
        ctx.deleteMessage();
        return await ctx.answerCallbackQuery({
          text: "All letters are already revealed.",
          show_alert: true,
        });
      }

      const randomIndex = Math.floor(Math.random() * remainingPositions.length);
      const newPosition = remainingPositions[randomIndex];
      if (!newPosition) break condition;

      const updatedRevealed = [...revealedPosition, newPosition];

      await redis.set(
        `${REDIS_PREFIX}game:${chatId}`,
        JSON.stringify({
          ...existingGame.data,
          revealedPositions: updatedRevealed,
        }),
      );

      await db
        .updateTable("users")
        .set({
          coins: sql`coins - ${calculateRevealPrice(existingGame.data.level)}`,
        })
        .where("id", "=", ctx.from.id.toString())
        .execute();

      const hint = createLetterHint(correctWord, updatedRevealed);

      await ctx.editMessageText(
        `<blockquote><a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "")}</a> revealed a letter. -${calculateRevealPrice(existingGame.data.level)} 🏵</blockquote>\n\n<b>Revealed Letter:</b> ${hint}`,
        {
          parse_mode: "HTML",
        },
      );
    } else if (callbackData.startsWith("cancel_reveal")) {
      const [, userId] = callbackData.split(" ");

      if (ctx.from.id.toString() !== userId) {
        return await ctx.answerCallbackQuery({
          text: "This is not for you!",
          show_alert: true,
        });
      }

      await ctx.deleteMessage();
    }
  }

  return await ctx.answerCallbackQuery();
});

export const callbackQueryHandler = composer;
