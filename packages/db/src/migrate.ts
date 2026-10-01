import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";
import { loadEnv } from "./env";

loadEnv();

async function main() {
  const { db, close } = createDb(undefined, { max: 1 });
  console.info("Applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Migrations applied.");
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
