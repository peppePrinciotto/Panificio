// stripe-webhook.js — Netlify Function
// Riceve eventi da Stripe, verifica la firma e gestisce
// payment_intent.succeeded: salva l'ordine su Supabase
// e chiama send-confirmation per l'email al cliente.
//
// Env vars richieste:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   URL  (impostata automaticamente da Netlify — URL del sito)

'use strict';

const Stripe = require('stripe');

// ============================================================
// Genera ID ordine
// ============================================================
function generateOrderId() {
  const now      = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand     = Math.floor(Math.random() * 90000) + 10000;
  return `ORD-${datePart}-${rand}`;
}

// ============================================================
// Salva ordine su Supabase
// ============================================================
async function saveOrderToSupabase(order) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Supabase non configurato');
  }

  const row = {
    id:             order.id,
    customer:       order.customer,
    items:          order.items,
    total:          order.total,
    shipping:       order.shipping_cost,
    payment_method: 'stripe',
    status:         'paid',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method:  'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase orders: ' + text);
  }
}

// ============================================================
// Handler principale
// ============================================================
exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  if (!sig) {
    return { statusCode: 400, body: 'Firma Stripe mancante' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET non configurato');
    return { statusCode: 500, body: 'Configurazione server incompleta' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  // Stripe richiede il body raw (non parsed) per verificare la firma
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Firma non valida:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Gestisci solo payment_intent.succeeded
  if (stripeEvent.type !== 'payment_intent.succeeded') {
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const pi   = stripeEvent.data.object;
  const meta = pi.metadata || {};

  let items   = [];
  let address = {};
  try { items   = JSON.parse(meta.items_data       || '[]'); } catch (_) {}
  try { address = JSON.parse(meta.customer_address  || '{}'); } catch (_) {}

  const orderId = generateOrderId();

  const order = {
    id:             orderId,
    customer_name:  meta.customer_name  || '',
    customer_email: meta.customer_email || '',
    customer_phone: meta.customer_phone || '',
    customer: {
      name:    meta.customer_name  || '',
      email:   meta.customer_email || '',
      phone:   meta.customer_phone || '',
      address,
    },
    shipping_address: address,
    items,
    subtotal:               parseFloat(meta.subtotal     || 0),
    shipping_cost:          parseFloat(meta.shipping_cost || 0),
    total:                  parseFloat(meta.total         || 0),
    payment_method:         'stripe',
    stripe_payment_intent:  pi.id,
    status:                 'paid',
  };

  // ── Salva ordine su Supabase ───────────────────────────────────
  try {
    await saveOrderToSupabase(order);
  } catch (err) {
    console.error('[stripe-webhook] Errore salvataggio Supabase:', err.message);
    // Non blocchiamo — tentiamo comunque di inviare l'email
  }

  // ── Invia email di conferma via send-confirmation ──────────────
  try {
    const siteUrl = (process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
    const emailRes = await fetch(`${siteUrl}/.netlify/functions/send-confirmation`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(order),
    });
    if (!emailRes.ok) {
      const text = await emailRes.text();
      console.error('[stripe-webhook] send-confirmation errore:', text);
    }
  } catch (err) {
    console.error('[stripe-webhook] send-confirmation non raggiungibile:', err.message);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, orderId }) };
};
