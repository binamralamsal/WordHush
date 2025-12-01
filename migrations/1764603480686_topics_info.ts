import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chat_game_topics")
    .addColumn("name", "text")
    .addColumn("icon_custom_emoji_id", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chat_game_topics")
    .dropColumn("name")
    .dropColumn("icon_custom_emoji_id")
    .execute();
}
