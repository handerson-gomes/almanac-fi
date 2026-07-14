import { expect, test } from "vitest";

import { createCliBootstrapMessage } from "./index.js";

test("uses the core workspace package", () => {
  expect(createCliBootstrapMessage()).toMatch(/@financial-ai\/core/);
});
