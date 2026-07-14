#!/usr/bin/env node
import { corePackageName } from "@financial-ai/core";

export function createMcpBootstrapMessage(): string {
  return `MCP boundary ready; shared code resolves from ${corePackageName}.`;
}

console.info(createMcpBootstrapMessage());
