import { expect, test } from "vitest";

import { createMcpBootstrapMessage } from "./index.js";

test("uses the core workspace package", () => {
  expect(createMcpBootstrapMessage()).toMatch(/@almanac-fi\/core/);
});
