import { Composer, Context } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";
import { REDIS_PREFIX, redis } from "../config/redis";
import { type GameSchema, redisGameSchema } from "../core/game";
import { CommandsHelper } from "../util/commands-helper";
import { escapeHtmlEntities } from "../util/escape-html-entities";

const composer = new Composer();

export async function endGame(
  ctx: Context,
  chatId: number,
  existingGame: GameSchema,
  reason: string,
) {
  await ctx.reply(
    `<blockquote>🎮 <b>Game Ended</b></blockquote>
<blockquote><b>Word:</b> ${existingGame.words[0]}
<b>All possible forms:</b> ${existingGame.words.join(", ")}
<b>Example:</b> ${escapeHtmlEntities(existingGame.sentence)}</blockquote>
<blockquote>${reason}
Start a new game with /newhush</blockquote>`,
    { parse_mode: "HTML" },
  );
  await redis.del(`${REDIS_PREFIX}game:${chatId}`);
  await redis.del(`${REDIS_PREFIX}vote:${chatId}`);
}

export async function isUserAuthorized(userId: string, chatId: string) {
  const authorized = await db
    .selectFrom("authorizedUsers")
    .where("userId", "=", userId)
    .where("chatId", "=", chatId)
    .executeTakeFirst();

  return !!authorized;
}

composer.command("endhush", async (ctx) => {
  const chatId = ctx.chat.id;
  if (!ctx.message) return;

  if (ctx.chat.is_forum) {
    const topicData = await db
      .selectFrom("chatGameTopics")
      .where("chatId", "=", chatId.toString())
      .selectAll()
      .execute();
    const topicIds = topicData.map((t) => t.topicId);
    if (
      topicData.length > 0 &&
      !topicIds.includes(ctx.msg.message_thread_id?.toString() || "")
    )
      return await ctx.reply(
        "This topic is not set for the game. Please play the game in the designated topic.",
      );
  }

  const data = await redis.get(`${REDIS_PREFIX}game:${chatId}`);
  const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

  if (!existingGame || !existingGame.success) {
    return ctx.reply("No active game to end. Start a new game with /newhush");
  }

  const userId = ctx.from.id.toString();
  const chatMember = await ctx.getChatMember(parseInt(userId));
  
  const isAdmin = chatMember.status === "administrator" || chatMember.status === "creator";
  const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
  const isGameStarter = existingGame.data.startedBy === userId;
  const isAuthorized = await isUserAuthorized(userId, chatId.toString());
  const isPrivate = ctx.chat.type === "private";
  
  const isPermitted = isAdmin || isSystemAdmin || isGameStarter || isAuthorized || isPrivate;
  
  if (isPermitted) {
    const userName = ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "");
    const userLink = `<a href="tg://user?id=${ctx.from.id}">${userName}</a>`;
  
    let reason = "";
  
    if (isPrivate) {
      reason = "";
    } else if (isSystemAdmin && !isAdmin && !isGameStarter && !isAuthorized) {
      reason = `<b>Ended by system administrator: </b>${userLink}`;
    } else if (isAdmin && !isGameStarter && !isAuthorized) {
      reason = `<b>Ended by group administrator: </b>${userLink}`;
    } else if (isGameStarter && !isAdmin && !isSystemAdmin && !isAuthorized) {
      reason = `<b>Ended by game starter: </b>${userLink}`;
    } else if (isAuthorized && !isAdmin && !isSystemAdmin && !isGameStarter) {
      reason = `<b>Ended by authorized user: </b>${userLink}`;
    } else {
      reason = `<b>Ended by: </b>${userLink}`;
    }
  
    return await endGame(ctx, chatId, existingGame.data, reason);
  }

  const voteKey = `${REDIS_PREFIX}vote:${chatId}`;
  const existingVotes = await redis.get(voteKey);

  if (existingVotes) {
    return await ctx.reply(
      "⏳ A vote to end the game is already in progress. Please wait for it to complete.",
    );
  }

  const voteData = {
    voters: [userId],
    initiatedAt: Date.now(),
  };

  await redis.setex(voteKey, 300, JSON.stringify(voteData)); // 5 minutes expiry

  const userName =
    ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "");

  await ctx.reply(
    `<b>🗳️ Vote to End Game</b>\n\n` +
      `<a href="tg://user?id=${ctx.from.id}">${userName}</a> wants to end the game.\n\n` +
      `<b>Votes needed: 3 out of remaining players</b>\n` +
      `<b>Current votes: 1/3</b>\n\n` +
      `React with the button below to vote for ending the game.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Vote to End (1/3)",
              callback_data: `vote_end ${chatId}`,
            },
          ],
        ],
      },
      parse_mode: "HTML",
    },
  );
});

CommandsHelper.addNewCommand("endhush", "End hush game running in this chat");

export const endhushCommand = composer;
