import type { difficultyLevels } from "./config/constants";
import { allowedChatSearchKeys, allowedChatTimeKeys } from "./config/constants";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  username: string | null;
  totalScore: number;
};

export type AllowedChatSearchKey = (typeof allowedChatSearchKeys)[number];
export type AllowedChatTimeKey = (typeof allowedChatTimeKeys)[number];

export type DifficultyLevels = (typeof difficultyLevels)[number];
