import { Composer } from "grammy";

import { endhushCommand } from "./endhush";
import { helpCommand } from "./help";
import { leaderboardCommand } from "./leaderboard";
import { myscoreCommand } from "./myscore";
import { newhushCommand } from "./newhush";

const composer = new Composer();

composer.use(
  helpCommand,
  newhushCommand,
  endhushCommand,
  leaderboardCommand,
  myscoreCommand,
);

export const commands = composer;
