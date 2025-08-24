import { Composer } from "grammy";

import { db } from "../config/db";
import { getUserScores } from "../services/get-user-scores";
import { CommandsHelper } from "../util/commands-helper";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { parseLeaderboardInput } from "../util/parse-leaderboard-input";

const composer = new Composer();

composer.command("myscore", async (ctx) => {
  if (!ctx.from) return;

  const chatId = ctx.chat.id.toString();

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

  const { searchKey, timeKey } = parseLeaderboardInput(
    ctx.match,
    ctx.chat.type === "private" ? "global" : undefined,
  );

  const keyboard = generateLeaderboardKeyboard(
    searchKey,
    timeKey,
    `myscore ${ctx.from.id}`,
  );

  const userId = ctx.from.id.toString();
  const userScores = await getUserScores({
    userId,
    chatId,
    searchKey,
    timeKey,
  });

  if (!userScores) return ctx.reply("You have no scores recorded yet.");

  const message = formatUserScoreMessage(userScores, searchKey);

  ctx.reply(message, {
    disable_notification: true,
    reply_markup: keyboard,
    parse_mode: "HTML",
    reply_parameters: {
      message_id: ctx.msgId,
    },
    link_preview_options: {
      is_disabled: true,
    },
  });
});

CommandsHelper.addNewCommand("myscore", "View your score.");

export const myscoreCommand = composer;
