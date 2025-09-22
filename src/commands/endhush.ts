import { Composer } from "grammy";

import { db } from "../config/db";
import { redis } from "../config/redis";
import { redisGameSchema } from "../core/game";
import { CommandsHelper } from "../util/commands-helper";
import { escapeHtmlEntities } from "../util/escape-html-entities";

const composer = new Composer();

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

  const data = await redis.get(`game:${chatId}`);
  const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

  if (!existingGame || !existingGame.success) {
    return ctx.reply("No active game to end. Start a new game with /newhush");
  }

  await ctx.reply(
    `<blockquote>🎮 <b>Game Ended</b></blockquote>

<blockquote><b>Word:</b> ${existingGame.data.words[0]}
<b>All possible forms:</b> ${existingGame.data.words.join(", ")}
<b>Example:</b> ${escapeHtmlEntities(existingGame.data.sentence)}</blockquote>

Start a new game with /newhush`,
    { parse_mode: "HTML" },
  );

  await redis.del(`game:${chatId}`);
});

CommandsHelper.addNewCommand("endhush", "End hush game running in this chat");

export const endhushCommand = composer;
