import { bot } from "../config/bot";

type Command = {
  command: string;
  description: string;
};

export class CommandsHelper {
  static commands: Array<Command> = [];

  static async addNewCommand(command: string, description: string) {
    this.commands.push({ command, description });
  }

  static async setCommands() {
    await bot.api.setMyCommands(this.commands);
  }
}
