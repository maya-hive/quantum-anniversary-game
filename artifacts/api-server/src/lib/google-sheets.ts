import { google, type sheets_v4 } from "googleapis";
import { logger } from "./logger";

const HEADER = [
  "player_name",
  "email",
  "phone",
  "shot_1_discount",
  "shot_2_discount",
  "shot_3_discount",
  "best_discount",
  "coupon_code",
  "timestamp",
] as const;

const EMAIL_COLUMN = 1;
const COUPON_COLUMN = 7;

export class SheetsProviderError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "SheetsProviderError";
    this.status = status;
  }
}

export type CampaignRecord = {
  name: string;
  email: string;
  phone: string;
  shots: Array<number | null>;
  best: number;
  couponCode: string | null;
  timestamp: string;
};

export type CampaignLookup = {
  exists: boolean;
  couponCode: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SheetsProviderError(`${name} is not configured on the API server`);
  }
  return value;
}

function spreadsheetId(): string {
  return requiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
}

function sheetTab(): string {
  return process.env["GOOGLE_SHEETS_TAB"]?.trim() || "Campaign";
}

function quoteSheetName(name: string): string {
  return `'${name.replaceAll("'", "''")}'`;
}

function dataRange(): string {
  return `${quoteSheetName(sheetTab())}!A:I`;
}

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus !== -1) {
    local = local.slice(0, plus);
  }

  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replaceAll(".", "");
    domain = "gmail.com";
  }

  return `${local}@${domain}`;
}

function readCoupon(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function privateKey(): string {
  return requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function sheetsClient(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: privateKey(),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

let emailCache: Map<string, string | null> | null = null;
let loadPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function isHeaderRow(row: unknown[] | undefined): boolean {
  return String(row?.[0] ?? "").trim().toLowerCase() === HEADER[0];
}

function applyRows(rows: unknown[][]): Map<string, string | null> {
  const next = new Map<string, string | null>();
  const start = isHeaderRow(rows[0]) ? 1 : 0;
  for (const row of rows.slice(start)) {
    const email = normalizeEmail(String(row[EMAIL_COLUMN] ?? ""));
    if (!email) continue;
    if (!next.has(email)) {
      next.set(email, readCoupon(row[COUPON_COLUMN]));
    }
  }
  return next;
}

async function loadCache(): Promise<void> {
  const sheets = sheetsClient();
  const id = spreadsheetId();
  let response: sheets_v4.Schema$ValueRange;
  try {
    response = (
      await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: dataRange(),
        majorDimension: "ROWS",
      })
    ).data;
  } catch (err) {
    logger.error({ err }, "Failed to load campaign Google Sheet");
    throw new SheetsProviderError("Could not reach the campaign spreadsheet");
  }

  const rows = (response.values ?? []) as unknown[][];
  if (rows.length === 0 || !isHeaderRow(rows[0])) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `${quoteSheetName(sheetTab())}!A1:I1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...HEADER]] },
      });
    } catch (err) {
      logger.error({ err }, "Failed to write campaign Google Sheet header");
      throw new SheetsProviderError("Could not initialize the campaign spreadsheet");
    }
  }

  emailCache = applyRows(rows);
}

async function ensureCache(): Promise<Map<string, string | null>> {
  if (emailCache) return emailCache;
  if (!loadPromise) {
    loadPromise = loadCache().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  await loadPromise;
  if (!emailCache) {
    throw new SheetsProviderError("Could not load the campaign spreadsheet");
  }
  return emailCache;
}

export async function lookupCampaignEmail(email: string): Promise<CampaignLookup> {
  const cache = await ensureCache();
  const key = normalizeEmail(email);
  if (!key) {
    return { exists: false, couponCode: null };
  }
  if (!cache.has(key)) {
    return { exists: false, couponCode: null };
  }
  return { exists: true, couponCode: cache.get(key) ?? null };
}

function recordValues(record: CampaignRecord): string[] {
  return [
    record.name,
    normalizeEmail(record.email),
    record.phone,
    record.shots[0] == null ? "" : String(record.shots[0]),
    record.shots[1] == null ? "" : String(record.shots[1]),
    record.shots[2] == null ? "" : String(record.shots[2]),
    String(record.best),
    record.couponCode ?? "",
    record.timestamp,
  ];
}

export async function appendCampaignRecord(
  record: CampaignRecord,
): Promise<CampaignLookup> {
  const task = writeChain.then(async () => {
    const cache = await ensureCache();
    const key = normalizeEmail(record.email);
    if (cache.has(key)) {
      return { exists: true as const, couponCode: cache.get(key) ?? null };
    }

    try {
      await sheetsClient().spreadsheets.values.append({
        spreadsheetId: spreadsheetId(),
        range: dataRange(),
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [recordValues(record)] },
      });
    } catch (err) {
      logger.error({ err }, "Failed to append campaign Google Sheet row");
      throw new SheetsProviderError("Could not save campaign results. Please try again.");
    }

    cache.set(key, record.couponCode);
    return { exists: true as const, couponCode: record.couponCode };
  });

  writeChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
