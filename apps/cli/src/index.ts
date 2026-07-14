#!/usr/bin/env node
import { corePackageName } from "@financial-ai/core";

export function createCliBootstrapMessage(): string {
  return `CLI boundary ready; shared code resolves from ${corePackageName}.`;
}

console.info(createCliBootstrapMessage());
