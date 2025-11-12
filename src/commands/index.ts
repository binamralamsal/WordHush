import { Composer } from "grammy";

import { endhushCommand } from "./endhush";
import { helpCommand } from "./help";
import { hushAuthCommand } from "./hushauth";
import { leaderboardCommand } from "./leaderboard";
import { myscoreCommand } from "./myscore";
import { newhushCommand } from "./newhush";
import { scoreCommand } from "./score";
import { setGameTopicCommand } from "./setgametopic";
import { statsCommand } from "./stats";
import { suggestWordCommand } from "./suggestword";
import { transferCommand } from "./transfer";
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
  statsCommand,
  suggestWordCommand,
  scoreCommand,
  hushAuthCommand,
  transferCommand,
);

export const commands = composer;
