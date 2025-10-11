import { randomInt } from "crypto";

import { REDIS_PREFIX, redis } from "../config/redis";
import words from "../data/words.json";
import type { DifficultyLevels } from "../types";

export interface WordData {
  meaning: string;
  pronunciation: string;
  example: string;
}

export interface WordSelectorConfig {
  historySize: number;
  resetThreshold: number;
  ttlSeconds: number;
  level: DifficultyLevels;
}

const levelMap = {
  easy: ["A1", "A2"],
  medium: ["B1"],
  hard: ["B2"],
  extreme: ["C1", "C2"],
} as const;

export class WordSelector {
  private config: WordSelectorConfig;

  constructor(config: Partial<WordSelectorConfig> = {}) {
    this.config = {
      historySize: config.historySize ?? 100,
      resetThreshold: config.resetThreshold ?? 10,
      ttlSeconds: config.ttlSeconds ?? 7 * 24 * 60 * 60, // 7 days
      level: config.level ?? "easy",
    };
  }

  getHistoryKey(chatId: string | number) {
    return `${REDIS_PREFIX}h:${chatId}`;
  }

  async getRandomWord(chatId: string | number): Promise<string> {
    const cefrLevels = levelMap[this.config.level];
    const allWords = cefrLevels.flatMap((level) => {
      const val = words[level];
      if (Array.isArray(val)) return val;
      return [];
    });

    if (!allWords.length)
      throw new Error("No words available for the selected level");

    const historyKey = this.getHistoryKey(chatId);

    try {
      const [members, count] = await Promise.all([
        redis.smembers(historyKey),
        redis.scard(historyKey),
      ]);

      if (members === undefined || count === undefined) {
        throw new Error("Redis commands failed");
      }

      const usedWords = members as string[];
      const setSize = count as number;

      const availableWords = allWords.filter(
        (word) => !usedWords.includes(word.toLowerCase()),
      );

      if (availableWords.length < this.config.resetThreshold) {
        const recentWords = usedWords.slice(
          -Math.floor(this.config.resetThreshold / 2),
        );
        await redis.del(historyKey);
        if (recentWords.length > 0) {
          await redis.sadd(historyKey, ...recentWords);
        }
        return this.getRandomWord(chatId);
      }

      const randomWord =
        availableWords[randomInt(0, availableWords.length)]!.toLowerCase();

      const operations: Promise<unknown>[] = [
        redis.sadd(historyKey, randomWord),
        redis.expire(historyKey, this.config.ttlSeconds),
      ];

      if (setSize >= this.config.historySize) {
        const trimCount = Math.floor(this.config.historySize * 0.2);
        operations.push(redis.spop(historyKey, trimCount));
      }

      await Promise.all(operations);

      return randomWord;
    } catch (error) {
      console.error("Redis error, using fallback:", error);
      return allWords[randomInt(0, allWords.length)]!.toLowerCase();
    }
  }

  async resetChat(chatId: string | number) {
    await redis.del(`${REDIS_PREFIX}h:${chatId}`);
  }

  async getRecentWords(chatId: string | number) {
    try {
      return await redis.smembers(`${REDIS_PREFIX}h:${chatId}`);
    } catch (error) {
      console.error("Error getting recent words:", error);
      return [];
    }
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<WordSelectorConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}
