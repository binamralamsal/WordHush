import { RedisClient } from "bun";

import { env } from "./env";

export const redis = new RedisClient(env.REDIS_URI);

export const REDIS_PREFIX = "wordhush_";
