import { expect, test } from "vitest";

import { createDatabase } from "@financial-ai/db";

import { listFixtures, seedFixture } from "./index.js";

test("each synthetic fixture seeds an isolated database with referential integrity", () => {
  for (const fixture of listFixtures()) {
    const database = createDatabase();
    database.migrate();
    const seeded = seedFixture(database, fixture.id);
    expect(seeded.sourceRecordIds).toHaveLength(fixture.records.length);
    expect(database.sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual(
      [],
    );
    expect(
      database.sqlite
        .prepare("SELECT COUNT(*) AS count FROM audit_events")
        .get(),
    ).toMatchObject({ count: fixture.records.length });
    database.close();
  }
});
