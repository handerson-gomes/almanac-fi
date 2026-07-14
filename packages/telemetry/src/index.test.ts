import { expect, test } from "vitest";

import { initializeTelemetry, redactAttributes, withSpan } from "./index.js";

test("metadata-only telemetry omits financial content by default", () => {
  expect(
    redactAttributes(
      { "feature.id": "budget", "transaction.amount": 1234 },
      "metadata-only",
    ),
  ).toEqual({ "feature.id": "budget" });
  const telemetry = initializeTelemetry();
  telemetry.startSpan("ignored", { "feature.id": "budget" }).end();
  expect(telemetry.spans).toEqual([]);
});

test("redacted and full modes require explicit configuration", async () => {
  expect(() => initializeTelemetry({ contentPolicy: "full" })).toThrow(
    /explicit enablement/,
  );
  const telemetry = initializeTelemetry({
    contentPolicy: "redacted",
    enabled: true,
    otlpEndpoint: "http://127.0.0.1:4318",
  });
  await withSpan(
    telemetry,
    "fixture.seed",
    { "feature.id": "fixtures", "transaction.amount": 1234 },
    async () => "ok",
  );
  expect(telemetry.spans[0]).toEqual({
    attributes: {
      "feature.id": "fixtures",
      "transaction.amount": "[REDACTED]",
    },
    name: "fixture.seed",
  });
});
