import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";

import { commands } from "./commands";
import { bot } from "./config/bot";
import { callbackQueryHandler } from "./handlers/callback-query";
import { onMessageHander } from "./handlers/on-message";
import { userSyncHandler } from "./handlers/user-sync-handler";
import { CommandsHelper } from "./util/commands-helper";

bot.api.config.use(autoRetry());

bot.use(userSyncHandler);

bot.use(
  sequentialize((ctx) => {
    if (ctx.callbackQuery) return undefined;

    return ctx.chatId?.toString() || ctx.from?.id.toString();
  }),
);

bot.use(commands);
bot.use(callbackQueryHandler);
bot.use(onMessageHander);

await bot.api.deleteWebhook({ drop_pending_updates: true });
run(bot);

console.log("Bot started");
await CommandsHelper.setCommands();
