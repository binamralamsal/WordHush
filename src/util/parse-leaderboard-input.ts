import {
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

export function parseLeaderboardInput(
  input: string,
  defaultSearchKey: AllowedChatSearchKey = "group",
  defaultTimeKey: AllowedChatTimeKey = "month",
) {
  const parts = input.toLowerCase().trim().split(" ");

  const searchKey = (parts.find((part) =>
    allowedChatSearchKeys.includes(part as AllowedChatSearchKey),
  ) || defaultSearchKey) as AllowedChatSearchKey;

  const timeKey = (parts.find((part) =>
    allowedChatTimeKeys.includes(part as AllowedChatTimeKey),
  ) || defaultTimeKey) as AllowedChatTimeKey;

  return { searchKey, timeKey };
}
