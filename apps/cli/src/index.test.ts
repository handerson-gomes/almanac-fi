import { expect, test } from "vitest";

import { createCliBootstrapMessage } from "./index.js";

test("displays the Almanac FI banner", () => {
  expect(createCliBootstrapMessage()).toBe(
    "almanac-fi v0.1.0 — your financial almanac",
  );
});
