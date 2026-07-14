#!/usr/bin/env node
export function createCliBootstrapMessage(): string {
  return "almanac-fi v0.1.0 — your financial almanac";
}

console.info(createCliBootstrapMessage());
