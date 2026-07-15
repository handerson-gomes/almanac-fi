# 022 — SimpleFIN connection flow

## Story

As a user, I can exchange a SimpleFIN setup token for a securely stored access URL and manage the connection.

## Requirements

Implement setup-token exchange client, input validation, SecretStore persistence, non-secret connection metadata, revocation/disconnect, and connection status UI.

## Acceptance criteria

Access URLs never enter ordinary database fields, telemetry, or API responses; failed exchanges preserve no secret; disconnect deletes the secret and updates state.

## Dependencies

015, 016a

## Verification

Mock SimpleFIN exchange and test connect/disconnect security behavior.

## Status

Deferred
