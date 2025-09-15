import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("word_hints")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedAlwaysAsIdentity(),
    )
    .addColumn("word", "varchar(255)", (col) => col.notNull())
    .addColumn("level", sql`game_level`, (col) => col.notNull())
    .addColumn("sentence", "text", (col) => col.notNull())
    .addColumn("related_words", sql`text[]`, (col) => col.notNull())
    .addColumn("hints", sql`text[]`, (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_word_hints_updated_at
    BEFORE UPDATE ON word_hints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createIndex("idx_word_hints_word")
    .on("word_hints")
    .column("word")
    .execute();

  await db.schema
    .createIndex("idx_word_hints_level")
    .on("word_hints")
    .column("level")
    .execute();

  await db.schema
    .createIndex("idx_word_hints_word_level")
    .on("word_hints")
    .columns(["word", "level"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("word_hints").ifExists().execute();
}
