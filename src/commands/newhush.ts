import { Composer, InlineKeyboard } from "grammy";

import { db } from "../config/db";
import { REDIS_PREFIX, redis } from "../config/redis";
import { redisGameSchema, startGame } from "../core/game";
import { CommandsHelper } from "../util/commands-helper";
import { resolveDifficulty } from "../util/resolve-difficulty";

const composer = new Composer();

function createDifficultyKeyboard() {
  return new InlineKeyboard()
    .text("Easy", "difficulty_easy")
    .text("Medium", "difficulty_medium")
    .row()
    .text("Hard", "difficulty_hard")
    .text("Extreme", "difficulty_extreme")
    .row()
    .text("Random", "difficulty_random");
}

composer.command("newhush", async (ctx) => {
  const chatId = ctx.chat.id;

  if (!ctx.message) return;

  if (ctx.chat.is_forum) {
    const topicData = await db
      .selectFrom("chatGameTopics")
      .where("chatId", "=", chatId.toString())
      .selectAll()
      .execute();
    const topicIds = topicData.map((t) => t.topicId);
    const currentTopicId = ctx.msg.message_thread_id?.toString() || "general";

    if (topicData.length > 0 && !topicIds.includes(currentTopicId))
      return await ctx.reply(
        "This topic is not set for the game. Please play the game in the designated topic.",
      );
  }

  const args = ctx.message?.text.split(" ");

  const difficultyArg = args[1]?.toLowerCase();

  const data = await redis.get(`${REDIS_PREFIX}game:${chatId}`);
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

  if (!difficultyArg) {
    await ctx.reply("🎯 **Choose your difficulty level:**", {
      parse_mode: "Markdown",
      reply_markup: createDifficultyKeyboard(),
      protect_content: true,
    });
    return;
  }

  const selectedLevel = resolveDifficulty(difficultyArg);
  if (!selectedLevel) {
    await ctx.reply(
      `❌ Invalid difficulty. Use: easy, medium, hard, extreme, or random`,
    );
    return;
  }

  await startGame(ctx, chatId, selectedLevel);
});

CommandsHelper.addNewCommand("newhush", "Start a new hush game");

export const newhushCommand = composer;
