#!/usr/bin/env node
import { corePackageName } from "@almanac-fi/core";

export function createMcpBootstrapMessage(): string {
  return `MCP boundary ready; shared code resolves from ${corePackageName}.`;
}

console.info(createMcpBootstrapMessage());
