import { createHmac } from "node:crypto";
import { logger } from "./logger";

export class CouponProviderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CouponProviderError";
    this.status = status;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new CouponProviderError(`${name} is not configured on the API server`, 500);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readCode(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function providerErrorMessage(payload: unknown, status: number): string {
  const root = asRecord(payload);
  const nestedError = root ? asRecord(asRecord(root.data)?.error) : null;
  const phpMessage = readCode(nestedError?.message);
  if (phpMessage) {
    return phpMessage.split("\n")[0] ?? phpMessage;
  }
  const restMessage = readCode(root?.message);
  if (restMessage) {
    return stripHtml(restMessage);
  }
  return `Coupon provider returned HTTP ${status}`;
}

export function extractCouponCode(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) {
    return readCode(payload);
  }

  const nested = asRecord(root.data) ?? asRecord(root.result) ?? asRecord(root.coupon);
  const sources = [root, nested];

  for (const source of sources) {
    if (!source) continue;
    const code =
      readCode(source.coupon_code) ??
      readCode(source.couponCode) ??
      readCode(source.code) ??
      readCode(source.coupon);
    if (code) return code;
  }

  return null;
}

function couponEndpoint(): string {
  return requiredEnv("BACKEND_ENDPOINT").replace(/[+\s/]+$/g, "");
}

export async function requestDynamicCoupon(
  customerEmail: string,
  discountAmount: number,
): Promise<string> {
  const secret = requiredEnv("FRONTEND_API_SECRET");
  const endpoint = couponEndpoint();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payloadString = `${customerEmail}|${discountAmount}|${timestamp}`;
  const signature = createHmac("sha256", secret)
    .update(payloadString)
    .digest("hex");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Timestamp": timestamp,
        "X-App-Signature": signature,
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: discountAmount,
      }),
    });
  } catch (err) {
    logger.error({ err, endpoint }, "WordPress coupon request failed to connect");
    throw new CouponProviderError("Could not reach the coupon service", 502);
  }

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw.trim() !== "") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    const message = providerErrorMessage(parsed, response.status);
    logger.warn(
      { status: response.status, endpoint, message },
      "WordPress coupon request failed",
    );
    throw new CouponProviderError(message, 502);
  }

  const couponCode = extractCouponCode(parsed);
  if (!couponCode) {
    logger.warn({ endpoint }, "WordPress coupon response missing code");
    throw new CouponProviderError("Coupon provider did not return a code", 502);
  }

  return couponCode;
}
