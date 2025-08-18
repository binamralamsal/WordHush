import { Composer } from "grammy";

import { endhushCommand } from "./endhush";
import { helpCommand } from "./help";
import { leaderboardCommand } from "./leaderboard";
import { newhushCommand } from "./newhush";

const composer = new Composer();

composer.use(helpCommand, newhushCommand, endhushCommand, leaderboardCommand);

export const commands = composer;
