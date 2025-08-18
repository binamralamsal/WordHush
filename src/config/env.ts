import { z } from "zod";

export const env = z
  .object({
    BOT_TOKEN: z.string().min(1, { message: "BOT_TOKEN is required" }),
    DATABASE_URI: z.string().min(1, { message: "DATABASE_URI is required" }),
    GEMINI_API_KEY: z
      .string()
      .min(1, { message: "GEMINI_API_KEY is required" }),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    ADMIN_USERS: z
      .string()
      .default("")
      .transform((val) => val.split(",").filter(Boolean).map(Number)),
    REDIS_URI: z.string().default("redis://127.0.0.1:6379"),
  })
  .parse(process.env);
