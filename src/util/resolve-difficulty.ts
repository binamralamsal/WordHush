import { difficultyLevels } from "../config/constants";
import type { DifficultyLevels } from "../types";

export function resolveDifficulty(difficultyArg: string) {
  if (difficultyArg === "random") {
    return (
      difficultyLevels[Math.floor(Math.random() * difficultyLevels.length)] ??
      "easy"
    );
  }

  if (difficultyLevels.includes(difficultyArg as DifficultyLevels)) {
    return difficultyArg as DifficultyLevels;
  }

  return null;
}
