import { Composer } from "grammy";

import { env } from "../config/env";
import { redis } from "../config/redis";
import { redisGameSchema } from "../core/game";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("endhush", async (ctx) => {
  const chatId = ctx.chat.id;
  if (!env.ALLOWED_CHATS.includes(chatId.toString()))
    return ctx.reply(
      "This game is only available in specific chats at the moment..",
    );

  if (!ctx.message) return;

  const data = await redis.get(`game:${chatId}`);
  const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

  if (!existingGame || !existingGame.success) {
    return ctx.reply("No active game to end. Start a new game with /newhush");
  }

  await ctx.reply(
    `<blockquote>🎮 <b>Game Ended</b></blockquote>

<blockquote><b>Word:</b> ${existingGame.data.words[0]}
<b>All possible forms:</b> ${existingGame.data.words.join(", ")}
<b>Example:</b> ${existingGame.data.sentence}</blockquote>

Start a new game with /newhush`,
    { parse_mode: "HTML" },
  );

  await redis.del(`game:${chatId}`);
});

CommandsHelper.addNewCommand("endhush", "End hush game running in this chat");

export const endhushCommand = composer;
