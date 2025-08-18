import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "./env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
