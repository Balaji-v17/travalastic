import 'dotenv/config';

/**
 * Registers an inbound webhook endpoint with Duffel for airline-initiated changes.
 *
 * Usage:
 *   node scripts/registerDuffelWebhook.js <webhook-url>
 *
 * Example:
 *   node scripts/registerDuffelWebhook.js https://api.travalastic.com/webhooks/duffel
 *
 * IMPORTANT:
 *   Duffel returns the webhook signing secret ONCE in the creation response.
 *   This script displays it on stdout with instructions to copy it immediately.
 *   The secret is NEVER written to disk, files, or persistent logs.
 *   DO NOT run this script in CI/automated builds without human presence.
 */

async function main() {
  const url = process.argv[2];

  if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    console.error('❌ Error: A valid webhook URL is required.');
    console.error('Usage: node scripts/registerDuffelWebhook.js <webhook-url>');
    console.error('Example: node scripts/registerDuffelWebhook.js https://api.travalastic.com/webhooks/duffel');
    process.exit(1);
  }

  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: DUFFEL_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log(`Registering Duffel webhook for URL: ${url}`);

  try {
    const response = await fetch('https://api.duffel.com/air/webhooks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: {
          url,
          events: ['order.airline_initiated_change_detected'],
        },
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      console.error(`❌ Duffel API returned HTTP ${response.status}:`, JSON.stringify(body.errors || body));
      process.exit(1);
    }

    const webhook = body?.data;
    const secret = webhook?.secret;

    console.log('\n========================================================================');
    console.log('✅ Duffel Webhook Successfully Registered!');
    console.log(`Webhook ID : ${webhook?.id}`);
    console.log(`Target URL : ${webhook?.url}`);
    console.log(`Events     : ${(webhook?.events || []).join(', ')}`);
    console.log(`Live Mode  : ${webhook?.live_mode ? 'Yes (Production)' : 'No (Test Mode)'}`);
    console.log('------------------------------------------------------------------------');
    console.log('⚠️  CRITICAL: Duffel provides the webhook signing secret ONLY ONCE.');
    console.log('Copy this secret into your host environment variable or .env file NOW:');
    console.log('\nDUFFEL_WEBHOOK_SECRET=' + secret + '\n');
    console.log('This secret has NOT been saved to any file or log.');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ Failed to register Duffel webhook:', err.message);
    process.exit(1);
  }
}

main();

