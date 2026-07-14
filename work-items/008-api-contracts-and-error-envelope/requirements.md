# 008 — API contracts and error envelope

## Story

As an API consumer, I receive stable validated request, response, pagination, and error shapes.

## Requirements

Create the api-contracts package with Zod schemas, RFC-style problem/error envelope, request IDs, and OpenAPI generation conventions.

## Acceptance criteria

Server routes validate at their boundary; errors never leak stack traces or secrets; generated OpenAPI includes a sample route.

## Dependencies

001, 004

## Verification

Typecheck contracts and run contract validation tests.

## Status

Complete
