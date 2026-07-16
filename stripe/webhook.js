// Stripe webhook to handle checkout completions
// Deploy this as a separate endpoint or Cloudflare Function
//
// Usage:
//   POST /stripe-webhook
//   Body: Stripe event JSON
//   Headers: stripe-signature

require('dotenv').config();
const express = require('express');
const router = express.Router();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function getPlanFromPrice(priceId) {
  const prices = {
    'price_pro': { plan: 'pro', limit: 500 },
    'price_business': { plan: 'business', limit: 5000 },
  };
  return prices[priceId] || null;
}

router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    const priceId = session.line_items?.data?.[0]?.price?.id;

    // TODO: Create API key, email it to the user
    // This is placeholder — we'll wire this up
    // 1. Generate random API key
    // 2. Store in Supabase api_keys table
    // 3. Email the key to the user
    console.log(`Checkout completed for ${email}, price: ${priceId}`);
  }

  res.json({ received: true });
});

module.exports = router;
