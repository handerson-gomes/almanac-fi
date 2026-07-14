import { expect, test } from "vitest";

import { previewCsv } from "./csv.js";

test("normalizes mapped CSV rows without using floating point", () => {
  const preview = previewCsv(
    "Date,Description,Amount\n07/13/2026,Coffee,4.50\n07/14/2026,Refund,-1.25",
    {
      amountColumn: "Amount",
      amountSign: "debit-positive",
      categoryColumn: null,
      dateColumn: "Date",
      dateFormat: "MM/DD/YYYY",
      descriptionColumn: "Description",
      payeeColumn: null,
    },
  );

  expect(preview).toMatchObject({
    errors: [],
    totalAmountMinor: -325,
    valid: true,
  });
  expect(preview.rows).toMatchObject([
    { amountMinor: -450, transactionDate: "2026-07-13T00:00:00.000Z" },
    { amountMinor: 125, transactionDate: "2026-07-14T00:00:00.000Z" },
  ]);
});

test("reports malformed CSV rows rather than coercing them", () => {
  const preview = previewCsv(
    "Date,Description,Amount\n2026-07-13,Coffee,4.567",
    {
      amountColumn: "Amount",
      amountSign: "debit-negative",
      categoryColumn: null,
      dateColumn: "Date",
      dateFormat: "YYYY-MM-DD",
      descriptionColumn: "Description",
      payeeColumn: null,
    },
  );

  expect(preview).toMatchObject({ valid: false });
  expect(preview.errors[0]).toMatchObject({ row: 2 });
});

test("accepts bank-formatted amounts and pending dates", () => {
  const preview = previewCsv(
    `Transaction Date,Transaction Description,Amount,Category
"PENDING - 07/13/2026","ACH DEBIT CRUNCH FIT","- $11.99","PENDING"
"PENDING - 07/10/2026","ACH DEP OPENARC xxxxx7449","+ $480","PENDING"
"2026-07-10","ONLINE TRANSFER FROM XXXXX7725","+ $4000",""
"2026-07-09","ZEL TO ASHLEY OHARA","- $2087","Travel"
"2026-07-08","DISCOVER E-PAYMENT ACH WEB 7225","- $4648.99","Credit Card"`,
    {
      amountColumn: "Amount",
      amountSign: "debit-negative",
      categoryColumn: "Category",
      dateColumn: "Transaction Date",
      dateFormat: "MM/DD/YYYY",
      descriptionColumn: "Transaction Description",
      payeeColumn: null,
    },
  );

  expect(preview).toMatchObject({
    errors: [],
    totalAmountMinor: -226_798,
    valid: true,
  });
  expect(preview.rows).toMatchObject([
    { amountMinor: -1_199, transactionDate: "2026-07-13T00:00:00.000Z" },
    { amountMinor: 48_000, transactionDate: "2026-07-10T00:00:00.000Z" },
    { amountMinor: 400_000, transactionDate: "2026-07-10T00:00:00.000Z" },
    { amountMinor: -208_700, transactionDate: "2026-07-09T00:00:00.000Z" },
    { amountMinor: -464_899, transactionDate: "2026-07-08T00:00:00.000Z" },
  ]);
});
