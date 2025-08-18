import type { AllowedChatSearchKey } from "../types";
import { escapeHtmlEntities } from "./escape-html-entities";

type FormatUserScoreData = {
  totalScore: number;
  rank: number;
  name: string;
  username: string | null;
  coins: number;
  id: string;
};

export function formatUserScoreMessage(
  data: FormatUserScoreData,
  searchKey: AllowedChatSearchKey,
): string {
  const escapedName = escapeHtmlEntities(data.name);
  const scopeText = searchKey === "global" ? "globally" : "in this chat";

  const userMention = data.username
    ? `<a href="https://t.me/${data.username}">${escapedName}</a>`
    : escapedName;

  const formattedScore = data.totalScore.toLocaleString();
  const formattedRank = data.rank.toLocaleString();
  const formattedCoins = data.coins.toLocaleString();

  const message = `
<blockquote><strong>🏆 ${userMention}'s Performance ${scopeText.charAt(0).toUpperCase() + scopeText.slice(1)} 🏆</strong></blockquote>

📊 <strong>Total Score:</strong> ${formattedScore}
🏵 <strong>Coins:</strong> ${formattedCoins}
🏅 <strong>Rank:</strong> #${formattedRank}
  `.trim();

  return message;
}
