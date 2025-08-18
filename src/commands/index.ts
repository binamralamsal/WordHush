import { Composer } from "grammy";
import { helpCommand } from "./help";
import { newhushCommand } from "./newhush";
import { endhushCommand } from "./endhush";

const composer = new Composer();

composer.use(helpCommand, newhushCommand, endhushCommand);

export const commands = composer;
