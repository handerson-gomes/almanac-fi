# 023a — Application UX foundation

## Story

As a user, I can comfortably navigate, read, and operate the local application before any visual-brand work begins.

## Requirements

Establish a reusable application styling foundation for the existing dashboard: typography, spacing, responsive page layout, navigation, forms, buttons, lists/tables, empty/loading/error states, and transaction amounts. Preserve semantic HTML and keyboard behavior. Apply the foundation to the current Accounts, Transactions, Categories, and CSV Import flows.

Do not introduce visual identity, marketing design, or a proprietary component library; this work is about clarity, consistency, and accessible operation.

## Acceptance criteria

The application is legible and usable at narrow and desktop widths; form controls and actions have consistent hierarchy and spacing; focus indicators and contrast are accessible; money is consistently formatted; dense transaction and import views remain scannable; existing UI smoke tests continue to pass.

## Dependencies

010, 016, 017, 018, 021

## Verification

Run visual/UI smoke tests for the current feature routes at narrow and desktop widths, plus keyboard-navigation checks for the main forms and actions.

## Status

Complete
