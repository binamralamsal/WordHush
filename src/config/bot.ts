import { Bot } from "grammy";

import { env } from "./env.ts";

export const bot = new Bot(env.BOT_TOKEN);
