export type CsvMapping = Readonly<{
  amountColumn: string;
  amountSign: "debit-negative" | "debit-positive";
  categoryColumn: string | null;
  dateColumn: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  descriptionColumn: string;
  payeeColumn: string | null;
}>;

export type CsvPreviewRow = Readonly<{
  amountMinor: number;
  merchant: string;
  payee: string | null;
  raw: Readonly<Record<string, string>>;
  row: number;
  sourceCategory: string | null;
  transactionDate: string;
}>;
export type CsvPreviewError = Readonly<{ message: string; row: number }>;
export type CsvPreview = Readonly<{
  errors: readonly CsvPreviewError[];
  rows: readonly CsvPreviewRow[];
  totalAmountMinor: number;
  valid: boolean;
}>;

function parseLine(line: string): string[] {
  const values: string[] = [];
  let quoted = false;
  let value = "";
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? "";
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  if (quoted) throw new Error("Unclosed quoted field");
  values.push(value.trim());
  return values;
}

function parseDate(value: string, format: CsvMapping["dateFormat"]): string {
  const pendingDate = /^PENDING\s*-\s*/i;
  const normalized = value.trim().replace(pendingDate, "");
  const resolvedFormat = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)
    ? "YYYY-MM-DD"
    : format;
  const parts = normalized.split(/[/-]/);
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error("Date does not match the selected format");
  }
  const [first = Number.NaN, second = Number.NaN, third = Number.NaN] =
    parts.map(Number);
  const [year, month, day] =
    resolvedFormat === "YYYY-MM-DD"
      ? [first, second, third]
      : resolvedFormat === "MM/DD/YYYY"
        ? [third, first, second]
        : [third, second, first];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date is not valid");
  }
  return date.toISOString();
}

function parseAmount(value: string, sign: CsvMapping["amountSign"]): number {
  const normalized = value
    .trim()
    .replaceAll(",", "")
    .replaceAll("$", "")
    .replaceAll(/\s/g, "");
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match)
    throw new Error("Amount must be a decimal with at most two places");
  const units = Number(match[2]);
  const cents = Number((match[3] ?? "").padEnd(2, "0"));
  const amount = units * 100 + cents;
  if (!Number.isSafeInteger(amount))
    throw new Error("Amount is outside the supported range");
  const signed = match[1] === "-" ? -amount : amount;
  return sign === "debit-positive" ? -signed : signed;
}

export function previewCsv(content: string, mapping: CsvMapping): CsvPreview {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    return {
      errors: [
        { message: "A header and at least one data row are required.", row: 1 },
      ],
      rows: [],
      totalAmountMinor: 0,
      valid: false,
    };
  }
  let headers: string[];
  try {
    headers = parseLine(lines[0] ?? "");
  } catch (error) {
    return {
      errors: [
        {
          message: error instanceof Error ? error.message : "Invalid header",
          row: 1,
        },
      ],
      rows: [],
      totalAmountMinor: 0,
      valid: false,
    };
  }
  const required = [
    mapping.amountColumn,
    mapping.dateColumn,
    mapping.descriptionColumn,
    mapping.categoryColumn,
    mapping.payeeColumn,
  ].filter((value): value is string => value !== null);
  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    return {
      errors: [{ message: `Missing mapped column: ${missing[0]}`, row: 1 }],
      rows: [],
      totalAmountMinor: 0,
      valid: false,
    };
  }
  const errors: CsvPreviewError[] = [];
  const rows: CsvPreviewRow[] = [];
  lines.slice(1).forEach((line, index) => {
    const row = index + 2;
    try {
      const values = parseLine(line);
      if (values.length !== headers.length)
        throw new Error("Column count does not match the header");
      const raw = Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex] ?? "",
        ]),
      );
      const merchant = raw[mapping.descriptionColumn]?.trim() ?? "";
      if (!merchant) throw new Error("Description is required");
      rows.push({
        amountMinor: parseAmount(
          raw[mapping.amountColumn] ?? "",
          mapping.amountSign,
        ),
        merchant,
        payee:
          mapping.payeeColumn === null
            ? null
            : raw[mapping.payeeColumn]?.trim() || null,
        raw,
        row,
        sourceCategory:
          mapping.categoryColumn === null
            ? null
            : raw[mapping.categoryColumn]?.trim() || null,
        transactionDate: parseDate(
          raw[mapping.dateColumn] ?? "",
          mapping.dateFormat,
        ),
      });
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : "Invalid row",
        row,
      });
    }
  });
  return {
    errors,
    rows,
    totalAmountMinor: rows.reduce((total, row) => total + row.amountMinor, 0),
    valid: errors.length === 0,
  };
}
