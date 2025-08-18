import { sql } from "kysely";

import { db } from "../config/db";

export async function getLeaderboardScores({
  chatId,
  searchKey,
  timeKey,
}: {
  chatId: string;
  searchKey: "group" | "global";
  timeKey: "today" | "week" | "month" | "year" | "all";
}) {
  const leaderboardQuery = db
    .selectFrom("leaderboard")
    .innerJoin("users", "users.id", "leaderboard.userId")
    .select((eb) => [
      "users.id as userId",
      "users.name as name",
      "users.username as username",
      sql<number>`cast(sum(${eb.ref("leaderboard.score")}) as integer)`.as(
        "totalScore",
      ),
    ])
    .groupBy("users.id")
    .orderBy(sql`sum(${sql.ref("leaderboard.score")}) desc`)
    .limit(20);

  if (searchKey === "group")
    leaderboardQuery.where("leaderboard.chatId", "=", chatId);
  if (timeKey !== "all") {
    leaderboardQuery.where((eb) => {
      if (timeKey === "today")
        return eb(
          sql`date_trunc('day', leaderboard.createdAt)`,
          "=",
          sql<Date>`date_trunc('day', now())`,
        );
      else if (timeKey === "week")
        return eb(
          sql`date_trunc('week', leaderboard.createdAt)`,
          "=",
          sql<Date>`date_trunc('week', now())`,
        );
      else if (timeKey === "month")
        return eb(
          sql`date_trunc('month', leaderboard.createdAt)`,
          "=",
          sql<Date>`date_trunc('month', now())`,
        );
      else
        return eb(
          "leaderboard.createdAt",
          "=",
          sql<Date>`date_trunc('year', now())`,
        );
    });
  }

  return await leaderboardQuery.execute();
}
