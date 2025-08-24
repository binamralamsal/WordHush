import { Composer } from "grammy";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("unsetgametopic", async (ctx) => {
  if (!ctx.chat.is_forum) {
    await ctx.reply("This command can only be used in forum groups.");
    return;
  }

  if (!ctx.msg.is_topic_message) {
    await ctx.reply("Please use this command within a topic.");
    return;
  }

  const topicId = ctx.msg.message_thread_id;

  if (!topicId) {
    await ctx.reply("Could not retrieve the topic ID.");
    return;
  }

  await db
    .deleteFrom("chatGameTopics")
    .where("chatId", "=", ctx.chat.id.toString())
    .where("topicId", "=", topicId.toString())
    .execute();

  await ctx.reply(`@${ctx.me.username} won't use this topic for the game.`);
});

CommandsHelper.addNewCommand(
  "unsetgametopic",
  "Unset current topic for the game",
);

export const unsetGameTopicCommand = composer;
