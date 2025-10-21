import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END
    $$;
  `.execute(db);

  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("username", "text")
    .addColumn("coins", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createType("game_level")
    .asEnum(["easy", "medium", "hard", "extreme"])
    .execute();

  await db.schema
    .createTable("leaderboard")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedAlwaysAsIdentity(),
    )
    .addColumn("user_id", "text", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("chat_id", "text", (col) => col.notNull())
    .addColumn("score", "integer", (col) => col.notNull())
    .addColumn("level", sql`game_level`, (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_leaderboard_updated_at
    BEFORE UPDATE ON leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("leaderboard").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
  await db.schema.dropType("game_level").ifExists().execute();

  await sql`
  DROP FUNCTION IF EXISTS update_updated_at_column();
`.execute(db);
}
