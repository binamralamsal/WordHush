import { Composer } from "grammy";

import { endhushCommand } from "./endhush";
import { helpCommand } from "./help";
import { newhushCommand } from "./newhush";

const composer = new Composer();

composer.use(helpCommand, newhushCommand, endhushCommand);

export const commands = composer;
