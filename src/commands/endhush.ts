import { Composer } from "grammy";
import { CommandsHelper } from "../util/commands-helper";
import { redisGameSchema, startGame } from "../core/game";
import { redis } from "../config/redis";

const composer = new Composer();

composer.command("endhush", async (ctx) => {
  const chatId = ctx.chat.id;

  if (!ctx.message) return;

  const data = await redis.get(`game:${chatId}`);
  const existingGame = data && redisGameSchema.safeParse(JSON.parse(data));

  if (!existingGame || !existingGame.success) {
    return ctx.reply("No active game to end. Start a new game with /newhush");
  }

  await ctx.reply(
    `<blockquote>🏳️ <b>Game Ended</b></blockquote>

The word was: <b>${existingGame.data.words[0]}</b>
All possible forms: ${existingGame.data.words.join(", ")}

Start a new game with /newhush`,
    { parse_mode: "HTML" }
  );

  await redis.del(`game:${chatId}`);
});

CommandsHelper.addNewCommand("endhush", "End hush game running in this chat");

export const endhushCommand = composer;
