# 028a — Investments, holdings, and investment transactions

## Story

As a user, I can maintain investment assets and transactions that retirement and allocation planning can use.

## Requirements

Add security, holding, and investment-transaction schemas, migrations, repositories, manual CRUD, source provenance, valuation/as-of fields, account relationships, and read capabilities. Support cash, quantity, price/value, cost-basis fields where known, and explicit unknown-data warnings; defer live brokerage aggregation.

## Acceptance criteria

Holdings are as-of dated and tied to accounts; investment transaction history is auditable; money and quantities cannot be conflated; retirement inputs can read a reconciled current asset value and identify missing valuation information.

## Dependencies

016, 017, 024

## Verification

Run migration, holding valuation, provenance, and retirement-input fixture tests.

## Status

Not started
