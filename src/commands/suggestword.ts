import { Composer } from "grammy";

import { env } from "../config/env";
import wordsData from "../data/words.json";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("suggestword", async (ctx) => {
  if (!ctx.from) return;

  const word = ctx.match.trim();

  const replyConfig = {
    reply_parameters: { message_id: ctx.msgId },
  };

  if (!word) {
    return ctx.reply(
      "❌ Please provide a word to suggest.\nUsage: /suggestword <word>",
      replyConfig,
    );
  }

  if (word.includes(" ")) {
    return ctx.reply(
      "❌ Please suggest only one word at a time (no spaces allowed).",
      replyConfig,
    );
  }

  if (!/^[a-zA-Z]+$/.test(word)) {
    return ctx.reply(
      "❌ The word must contain only letters (no numbers or special characters).",
      replyConfig,
    );
  }

  const normalizedWord = word.toLowerCase();
  let wordExists = false;

  for (const level of Object.keys(wordsData)) {
    const words = wordsData[level as keyof typeof wordsData];
    for (const entry of words) {
      const variants = entry.toLowerCase().split("/");
      if (variants.includes(normalizedWord)) {
        wordExists = true;
        break;
      }
    }
    if (wordExists) break;
  }

  if (wordExists) {
    return ctx.reply(
      "❌ This word already exists in our database.",
      replyConfig,
    );
  }

  const suggestionMessage =
    `<blockquote>📝 <b>New Word Suggestion: ${word}</b>\n\n` +
    `<b>Suggested by:</b> ${ctx.from.first_name}${ctx.from.last_name ? " " + ctx.from.last_name : ""}\n` +
    `<b>Username:</b> ${ctx.from.username ? "@" + ctx.from.username : "N/A"}\n` +
    `<b>User ID:</b> ${ctx.from.id}</blockquote>`;

  if (env.SUGGESTIONS_CHANNEL) {
    try {
      await ctx.api.sendMessage(env.SUGGESTIONS_CHANNEL, suggestionMessage, {
        parse_mode: "HTML",
      });
      return ctx.reply(
        "✅ Your word suggestion has been submitted successfully!",
        replyConfig,
      );
    } catch (error) {
      console.error("Failed to send to suggestions channel:", error);
    }
  }

  let sentToAdmins = false;
  for (const adminId of env.ADMIN_USERS) {
    try {
      await ctx.api.sendMessage(adminId, suggestionMessage, {
        parse_mode: "HTML",
      });
      sentToAdmins = true;
    } catch (error) {
      console.error(`Failed to send suggestion to admin ${adminId}:`, error);
    }
  }

  if (sentToAdmins) {
    return ctx.reply(
      "✅ Your word suggestion has been submitted successfully!",
      replyConfig,
    );
  } else {
    return ctx.reply(
      "❌ Failed to submit your suggestion. Please try again later.",
      replyConfig,
    );
  }
});

CommandsHelper.addNewCommand("suggestword", "Suggest a new word for the bot.");

export const suggestWordCommand = composer;
