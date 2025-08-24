import { Composer } from "grammy";

import { endhushCommand } from "./endhush";
import { helpCommand } from "./help";
import { leaderboardCommand } from "./leaderboard";
import { myscoreCommand } from "./myscore";
import { newhushCommand } from "./newhush";
import { setGameTopicCommand } from "./setgametopic";
import { unsetGameTopicCommand } from "./unsetgametopic";

const composer = new Composer();

composer.use(
  helpCommand,
  newhushCommand,
  endhushCommand,
  leaderboardCommand,
  myscoreCommand,
  setGameTopicCommand,
  unsetGameTopicCommand,
);

export const commands = composer;
