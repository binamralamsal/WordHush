import { Composer, InlineKeyboard } from "grammy";

import { sql } from "kysely";
import z from "zod";

import { endGame, isUserAuthorized } from "../commands/endhush";
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
import { formatNoScoresMessage } from "../util/format-no-scores-message";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { generateUserSelectionKeyboard } from "../util/generate-user-selection-keyboard";
import { getSmartDefaults } from "../util/get-smart-defaults";
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
  } else if (callbackData.startsWith("score_list")) {
    const parts = ctx.callbackQuery.data.split(" ");

    const [, username] = parts;
    if (!username) break condition;

    const users = await db
      .selectFrom("users")
      .select(["id", "name", "username"])
      .where(sql`lower(username)`, "=", username)
      .execute();

    if (users.length === 0) {
      return ctx.answerCallbackQuery({
        text: "No users found with this username.",
        show_alert: true,
      });
    }

    const keyboard = generateUserSelectionKeyboard(users, username);

    await ctx
      .editMessageText(
        `⚠️ <strong>Multiple Users Found</strong>\n\n` +
          `There are ${users.length} users with username @${username}. ` +
          `This can happen when a user deletes their account and someone else creates a new account with the same username.\n\n` +
          `Please select the user you want to view:`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        },
      )
      .catch(() => {});

    return await ctx.answerCallbackQuery();
  } else if (callbackData.startsWith("score")) {
    const parts = ctx.callbackQuery.data.split(" ");

    if (callbackData.startsWith("score_select")) {
      const [, userId, username] = parts;
      if (!userId) break condition;
      if (!ctx.chat) break condition;

      const chatId = ctx.chat.id.toString();

      const userInfo = await db
        .selectFrom("users")
        .select(["name"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!userInfo) {
        return ctx.answerCallbackQuery({
          text: "User not found.",
          show_alert: true,
        });
      }

      const { searchKey, timeKey, hasAnyScores } = await getSmartDefaults({
        userId,
        chatId,
        requestedSearchKey: undefined,
        requestedTimeKey: undefined,
        chatType: ctx.chat.type,
      });

      const userScore = await getUserScores({
        chatId,
        userId,
        searchKey,
        timeKey,
      });

      if (!userScore) {
        const message = formatNoScoresMessage({
          isOwnScore: false,
          userName: userInfo.name,
          searchKey,
          timeKey,
          wasTimeKeyExplicit: false,
          hasAnyScores,
        });

        const backButtonDetails = {
          text: "⬅️ Back to user list",
          callback: `score_list ${username}`,
        };

        const keyboard = hasAnyScores
          ? generateLeaderboardKeyboard(
              searchKey,
              timeKey,
              `score ${userId}`,
              username ? backButtonDetails : undefined,
            )
          : new InlineKeyboard().text(
              backButtonDetails.text,
              backButtonDetails.callback,
            );

        await ctx
          .editMessageText(message, {
            reply_markup: keyboard,
          })
          .catch(() => {});

        return ctx.answerCallbackQuery({
          text: "No scores found for the current filter.",
        });
      }

      const keyboard = generateLeaderboardKeyboard(
        searchKey,
        timeKey,
        `score ${userId}`,
        username
          ? {
              text: "⬅️ Back to user list",
              callback: `score_list ${username}`,
            }
          : undefined,
      );

      await ctx
        .editMessageText(formatUserScoreMessage(userScore, searchKey), {
          reply_markup: keyboard,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {});

      return await ctx.answerCallbackQuery();
    }

    if (
      callbackData.startsWith("score ") &&
      !callbackData.startsWith("score_select") &&
      !callbackData.startsWith("score_list")
    ) {
      const [, userId, searchKey, timeKey] = parts;
      if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
        break condition;
      if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
        break condition;
      if (!ctx.chat) break condition;
      if (!userId) break condition;

      const chatId = ctx.chat.id.toString();

      const userInfo = await db
        .selectFrom("users")
        .select(["name"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!userInfo) {
        return ctx.answerCallbackQuery({
          text: "User not found.",
          show_alert: true,
        });
      }

      let hasAnyScoresQuery = db
        .selectFrom("leaderboard")
        .select("userId")
        .where("userId", "=", userId)
        .limit(1);

      if (searchKey === "group") {
        hasAnyScoresQuery = hasAnyScoresQuery.where("chatId", "=", chatId);
      }

      const hasAnyScores = !!(await hasAnyScoresQuery.executeTakeFirst());

      const userScore = await getUserScores({
        chatId,
        userId,
        searchKey: searchKey as AllowedChatSearchKey,
        timeKey: timeKey as AllowedChatTimeKey,
      });

      if (!userScore) {
        const message = formatNoScoresMessage({
          isOwnScore: userId === ctx.from?.id.toString(),
          userName: userInfo.name,
          searchKey: searchKey as AllowedChatSearchKey,
          timeKey: timeKey as AllowedChatTimeKey,
          wasTimeKeyExplicit: true,
          hasAnyScores,
        });

        const keyboard = generateLeaderboardKeyboard(
          searchKey as AllowedChatSearchKey,
          timeKey as AllowedChatTimeKey,
          `score ${userId}`,
        );

        await ctx
          .editMessageText(message, {
            reply_markup: keyboard,
          })
          .catch(() => {});

        return ctx.answerCallbackQuery({
          text: "No scores found for this period.",
          show_alert: false,
        });
      }

      const keyboard = generateLeaderboardKeyboard(
        searchKey as AllowedChatSearchKey,
        timeKey as AllowedChatTimeKey,
        `score ${userId}`,
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
  } else if (callbackData.startsWith("vote_end")) {
    const [, chatIdStr] = callbackData.split(" ");
    if (!chatIdStr) return;

    const chatId = parseInt(chatIdStr);

    if (!ctx.chat || ctx.chat.id !== chatId) {
      return await ctx.answerCallbackQuery({
        text: "This vote is not for this chat.",
        show_alert: true,
      });
    }

    const data = await redis.get(`${REDIS_PREFIX}game:${chatId}`);
    const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

    if (!existingGame || !existingGame.success) {
      return await ctx.answerCallbackQuery({
        text: "No active game found.",
        show_alert: true,
      });
    }

    const userId = ctx.from.id.toString();
    const voteKey = `${REDIS_PREFIX}vote:${chatId}`;
    const voteDataStr = await redis.get(voteKey);

    if (!voteDataStr) {
      return await ctx.answerCallbackQuery({
        text: "The voting session has expired.",
        show_alert: true,
      });
    }

    const voteData = JSON.parse(voteDataStr);

    if (voteData.voters.includes(userId)) {
      return await ctx.answerCallbackQuery({
        text: "You have already voted.",
      });
    }

    const chatMember = await ctx.getChatMember(parseInt(userId));
    const isAdmin =
      chatMember.status === "administrator" || chatMember.status === "creator";
    const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
    const isAuthorized = await isUserAuthorized(userId, chatId.toString());
    const isGameStarter = existingGame.data.startedBy === userId;

    if (isAdmin || isSystemAdmin || isGameStarter || isAuthorized) {
      const userName =
        ctx.from.first_name +
        (ctx.from.last_name ? " " + ctx.from.last_name : "");
      const userLink = `<a href="tg://user?id=${ctx.from.id}">${userName}</a>`;

      let reason = "";
      if ((isAdmin || isSystemAdmin) && !isGameStarter && !isAuthorized) {
        reason = `<b>Ended by group administrator: </b>${userLink}`;
      } else if (isGameStarter && !isAdmin && !isSystemAdmin && !isAuthorized) {
        reason = `<b>Ended by game starter: </b>${userLink}`;
      } else if (isAuthorized && !isAdmin && !isSystemAdmin && !isGameStarter) {
        reason = `<b>Ended by authorized user: </b>${userLink}`;
      } else {
        reason = `<b>Ended by group administrator or game starter: </b>${userLink}`;
      }

      await ctx.deleteMessage();
      await endGame(ctx, chatId, existingGame.data, reason);

      return await ctx.answerCallbackQuery({
        text: "Game ended by admin/game starter! 🎯",
      });
    }

    voteData.voters.push(userId);

    if (voteData.voters.length >= 3) {
      await redis.del(voteKey);

      const reason = "<b>Game ended - 3 players voted to end the game</b>";
      await ctx.deleteMessage();
      await endGame(ctx, chatId, existingGame.data, reason);

      return await ctx.answerCallbackQuery({
        text: "Game ended! Voting threshold reached. 🎯",
      });
    }

    await redis.setex(voteKey, 300, JSON.stringify(voteData));

    const votesNeeded = 3 - voteData.voters.length;

    await ctx.editMessageText(
      `<b>🗳️ Vote to End Game</b>\n\n` +
        `Players are voting to end the game.\n\n` +
        `<b>Votes needed: 3 total</b>\n` +
        `<b>Current votes: ${voteData.voters.length}/3</b>\n\n` +
        `React with the button below to vote for ending the game.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `✅ Vote to End (${voteData.voters.length}/3)`,
                callback_data: `vote_end ${chatId}`,
              },
            ],
          ],
        },
        parse_mode: "HTML",
      },
    );

    await ctx.answerCallbackQuery({
      text: `Vote recorded! ${votesNeeded} more votes needed.`,
    });
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
