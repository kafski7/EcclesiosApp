import { sql, type Column, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * "table"."column" — always qualified.
 *
 * Drizzle writes columns WITHOUT the table name when a query reads from a single table, so an
 * outer column inside a hand-written subquery like
 *   sql`(select count(*) from ${hymnTunes} where ${hymnTunes.hymnId} = ${hymns.id})`
 * renders as `… where "hymn_id" = "id"`, and Postgres binds "id" to the INNER table.
 * Use `qcol(hymns, hymns.id)` for every outer reference in a correlated subquery (D-033).
 */
export const qcol = (table: PgTable, column: Column): SQL => sql`${table}.${sql.identifier(column.name)}`;
