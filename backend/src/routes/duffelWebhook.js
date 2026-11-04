import express from 'express';
import { verifyDuffelSignature } from '../services/disruptions/duffelSignature.js';
import { handleDuffelEvent } from '../services/disruptions/ingest.js';

// Startup warning if DUFFEL_WEBHOOK_SECRET is not configured
if (!process.env.DUFFEL_WEBHOOK_SECRET) {
  console.warn(
    '⚠️ DUFFEL_WEBHOOK_SECRET is not configured; /webhooks/duffel will return 503 Service Unavailable'
  );
}

const router = express.Router();

/**
 * Inbound webhook handler for Duffel notifications.
 *
 * Route: POST /webhooks/duffel
 * Security: Validates HMAC-SHA256 signature in X-Duffel-Signature header.
 * No JWT auth middleware is used since Duffel servers authenticate via HMAC signature.
 */
router.post(['/', '/duffel', '/webhooks/duffel'], async (req, res) => {
  const secret = process.env.DUFFEL_WEBHOOK_SECRET;

  // 1. If secret is not configured, respond 503 and never process unsigned requests
  if (!secret) {
    return res.status(503).json({ error: 'webhook not configured' });
  }

  // 2. Extract signature header and raw request body
  const header = req.headers['x-duffel-signature'];
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body || {});

  const toleranceSeconds = process.env.DUFFEL_WEBHOOK_TOLERANCE_SECONDS
    ? parseInt(process.env.DUFFEL_WEBHOOK_TOLERANCE_SECONDS, 10)
    : 0;

  // 3. Verify signature strictly against raw bytes before inspecting body
  const verification = verifyDuffelSignature({
    rawBody,
    header,
    secret,
    toleranceSeconds,
  });

  if (!verification.ok) {
    // Return generic 401 response; internal reasons are never leaked to callers
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 4. Parse JSON payload
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // 5. Filter event type: handle ONLY order.airline_initiated_change_detected
  // Other event types (including test/ping events) return 200 { received: true, ignored: true }
  if (event?.type !== 'order.airline_initiated_change_detected') {
    console.log(
      `[Duffel Webhook] Ignored event type: ${event?.type}, eventId: ${event?.id}`
    );
    return res.status(200).json({ received: true, ignored: true });
  }

  // 6. Ingest event through shared disruption service
  try {
    const outcome = await handleDuffelEvent(event);
    const outcomeLabel = outcome?.skipped
      ? `skipped:${outcome.skipped}`
      : outcome?.duplicate
      ? 'duplicate'
      : 'success';

    console.log(
      `[Duffel Webhook] Processed event: ${event?.id}, type: ${event?.type}, outcome: ${outcomeLabel}`
    );
    return res.status(200).json({ received: true, ...outcome });
  } catch (err) {
    // Duffel fetch failure or unexpected DB error: respond 500 so Duffel can retry.
    // Note: Duffel's retry behavior is undocumented, but idempotency_key deduplication makes retries safe.
    console.error(
      `[Duffel Webhook] Internal processing error for event ${event?.id}:`,
      err.message
    );
    return res.status(500).json({ error: 'Internal processing error' });
  }
});

export default router;

