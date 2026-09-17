import { Router, type IRouter } from "express";
import {
  CompleteCampaignBody,
  CompleteCampaignResponse,
  LookupCampaignBody,
  LookupCampaignResponse,
} from "@workspace/api-zod";
import {
  appendCampaignRecord,
  lookupCampaignEmail,
  normalizeEmail,
  SheetsProviderError,
} from "../lib/google-sheets";
import { requestDynamicCoupon, CouponProviderError } from "../lib/wordpress-coupon";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function providerStatus(err: unknown): number {
  if (err instanceof SheetsProviderError || err instanceof CouponProviderError) {
    return err.status;
  }
  return 502;
}

function providerMessage(err: unknown, fallback: string): string {
  if (err instanceof SheetsProviderError || err instanceof CouponProviderError) {
    return err.message;
  }
  return fallback;
}

router.post("/campaign/lookup", async (req, res) => {
  try {
    const parsed = LookupCampaignBody.safeParse(req.body);
    if (!parsed.success || parsed.data.email.trim() === "") {
      res.status(400).json({ message: "Invalid campaign payload." });
      return;
    }

    try {
      const result = LookupCampaignResponse.parse(
        await lookupCampaignEmail(parsed.data.email),
      );
      res.json(result);
    } catch (err) {
      logger.error({ err }, "Failed to look up campaign email");
      res.status(providerStatus(err)).json({
        message: providerMessage(
          err,
          "Could not check this email. Please try again.",
        ),
      });
    }
  } catch (err) {
    logger.error({ err }, "Unhandled campaign lookup error");
    res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Could not check this email. Please try again.",
    });
  }
});

router.post("/campaign/complete", async (req, res) => {
  try {
    const parsed = CompleteCampaignBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid campaign payload." });
      return;
    }

    const body = parsed.data;
    const email = normalizeEmail(body.email);

    try {
      const existing = await lookupCampaignEmail(email);
      if (existing.exists) {
        const data = CompleteCampaignResponse.parse({
          couponCode: existing.couponCode,
        });
        res.json(data);
        return;
      }
    } catch (err) {
      logger.error({ err }, "Failed to look up campaign email before complete");
      res.status(providerStatus(err)).json({
        message: providerMessage(
          err,
          "Could not check this email. Please try again.",
        ),
      });
      return;
    }

    let couponCode: string | null = null;

    if (body.best > 0) {
      try {
        couponCode = await requestDynamicCoupon(email, body.best);
      } catch (err) {
        logger.error({ err }, "Failed to generate campaign coupon");
        const message =
          err instanceof CouponProviderError
            ? err.message
            : "Could not generate a coupon. Please try again.";
        res
          .status(err instanceof CouponProviderError ? err.status : 502)
          .json({ message });
        return;
      }
    }

    try {
      const recorded = await appendCampaignRecord({
        name: body.name,
        email,
        phone: body.phone,
        shots: body.shots,
        best: body.best,
        couponCode,
        timestamp: body.timestamp,
      });
      couponCode = recorded.couponCode;
      logger.info("Appended campaign Google Sheet row");
    } catch (err) {
      logger.error({ err }, "Failed to write campaign Google Sheet");
      res.status(providerStatus(err)).json({
        message: providerMessage(
          err,
          "Could not save campaign results. Please try again.",
        ),
      });
      return;
    }

    const data = CompleteCampaignResponse.parse({ couponCode });
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Unhandled campaign complete error");
    res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Could not complete this round. Please try again.",
    });
  }
});

export default router;
