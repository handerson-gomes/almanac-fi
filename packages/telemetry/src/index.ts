import { z } from "zod";

export const contentPolicySchema = z.enum([
  "metadata-only",
  "redacted",
  "full",
]);
export type ContentPolicy = z.infer<typeof contentPolicySchema>;

export const telemetryConfigSchema = z
  .object({
    contentPolicy: contentPolicySchema.default("metadata-only"),
    enabled: z.boolean().default(false),
    otlpEndpoint: z.string().url().optional(),
  })
  .superRefine((config, context) => {
    if (config.contentPolicy !== "metadata-only" && !config.enabled) {
      context.addIssue({
        code: "custom",
        message: "Redacted and full telemetry require explicit enablement",
        path: ["enabled"],
      });
    }
  });
export type TelemetryConfig = z.infer<typeof telemetryConfigSchema>;
export type SpanAttributes = Readonly<
  Record<string, boolean | number | string>
>;
export type FinishedSpan = Readonly<{
  attributes: SpanAttributes;
  name: string;
}>;

const allowedAttributeNames = new Set([
  "error.type",
  "feature.id",
  "operation.name",
  "request.id",
  "route.id",
  "workflow.id",
]);
const sensitiveName =
  /amount|balance|currency|email|financial|merchant|payload|secret|transaction/i;

export function redactAttributes(
  attributes: SpanAttributes,
  policy: ContentPolicy,
): SpanAttributes {
  const entries = Object.entries(attributes).flatMap(([key, value]) => {
    if (policy === "metadata-only") {
      return allowedAttributeNames.has(key) && !sensitiveName.test(key)
        ? [[key, value] as const]
        : [];
    }
    if (policy === "redacted") {
      return [[key, sensitiveName.test(key) ? "[REDACTED]" : value] as const];
    }
    return [[key, value] as const];
  });
  return Object.freeze(Object.fromEntries(entries));
}

export interface Telemetry {
  readonly config: TelemetryConfig;
  readonly spans: readonly FinishedSpan[];
  startSpan(
    name: string,
    attributes?: SpanAttributes,
  ): { end: (additionalAttributes?: SpanAttributes) => void };
}

export function initializeTelemetry(
  input: Partial<TelemetryConfig> = {},
): Telemetry {
  const config = telemetryConfigSchema.parse(input);
  const spans: FinishedSpan[] = [];
  return Object.freeze({
    config,
    spans,
    startSpan(name: string, attributes: SpanAttributes = {}) {
      const initial = redactAttributes(attributes, config.contentPolicy);
      let ended = false;
      return {
        end(additionalAttributes: SpanAttributes = {}) {
          if (ended || !config.enabled) return;
          ended = true;
          spans.push(
            Object.freeze({
              attributes: redactAttributes(
                { ...initial, ...additionalAttributes },
                config.contentPolicy,
              ),
              name,
            }),
          );
        },
      };
    },
  });
}

export async function withSpan<Result>(
  telemetry: Telemetry,
  name: string,
  attributes: SpanAttributes,
  work: () => Promise<Result>,
): Promise<Result> {
  const span = telemetry.startSpan(name, attributes);
  try {
    const result = await work();
    span.end();
    return result;
  } catch (error: unknown) {
    span.end({
      "error.type": error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
