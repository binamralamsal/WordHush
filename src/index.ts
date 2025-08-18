import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";
import { bot } from "./config/bot";
import { commands } from "./commands";
import { CommandsHelper } from "./util/commands-helper";
import { callbackQueryHandler } from "./handlers/callback-query";
import { onMessageHander } from "./handlers/on-message";

bot.api.config.use(autoRetry());
bot.use(
  sequentialize((ctx) => {
    return ctx.chatId?.toString() || ctx.from?.id.toString();
  })
);

bot.use(commands);
bot.use(callbackQueryHandler);
bot.use(onMessageHander);

run(bot);

console.log("Bot started");
await CommandsHelper.setCommands();
