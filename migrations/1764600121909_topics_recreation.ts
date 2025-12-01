import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chat_game_topics")
    .addColumn("should_recreate_on_expire", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chat_game_topics")
    .dropColumn("should_recreate_on_expire")
    .execute();
}
