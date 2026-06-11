// stripe-webhook.js — Netlify Function
// Riceve eventi da Stripe, verifica la firma e gestisce
// payment_intent.succeeded: salva l'ordine su Supabase,
// notifica il titolare su Telegram e chiama send-confirmation
// per l'email al cliente.
//
// Env vars richieste:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   URL  (impostata automaticamente da Netlify — URL del sito)
// Env vars opzionali (notifiche Telegram):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID

'use strict';

const Stripe = require('stripe');

// ============================================================
// Escape HTML per i messaggi Telegram (parse_mode: HTML)
// ============================================================
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// Notifica Telegram al titolare per ogni nuovo ordine
// Degradazione morbida: se le env var mancano o la chiamata
// fallisce, logga ma non lancia mai (non blocca l'ordine).
// ============================================================
async function notifyTelegram(order) {
  const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID non configurati — notifica saltata');
    return;
  }

  // Riga prodotti
  const itemLines = (order.items || []).map(function (i) {
    const qty = Number(i.quantity || 1);
    const sub = Number(i.subtotal || 0).toFixed(2);
    return `• ${escapeHtml(i.name || '—')} × ${qty} — €${sub}`;
  }).join('\n');

  // Spedizione
  const shippingLine = (Number(order.shipping_cost) === 0)
    ? 'Gratuita'
    : `€${Number(order.shipping_cost || 0).toFixed(2)}`;

  // Indirizzo di consegna
  const addr     = order.shipping_address || {};
  const province = addr.province ? ` (${escapeHtml(addr.province)})` : '';
  const addrLines = [
    escapeHtml(addr.street || ''),
    `${escapeHtml(addr.zip || '')} ${escapeHtml(addr.city || '')}${province}`.trim(),
    'Italia',
  ].filter(Boolean).join('\n');

  const text =
    `🥖 <b>NUOVO ORDINE</b>\n\n` +
    `🧾 <b>Ordine:</b> ${escapeHtml(order.id)}\n` +
    `💰 <b>Totale:</b> €${Number(order.total || 0).toFixed(2)}\n\n` +
    `👤 <b>Cliente</b>\n` +
    `${escapeHtml(order.customer_name || '—')}\n` +
    (order.customer_email ? `📧 ${escapeHtml(order.customer_email)}\n` : '') +
    (order.customer_phone ? `📞 ${escapeHtml(order.customer_phone)}\n` : '') +
    `\n📦 <b>Prodotti</b>\n${itemLines || '—'}\n\n` +
    `🚚 <b>Spedizione:</b> ${shippingLine}\n` +
    `🏠 <b>Consegna</b>\n${addrLines}`;

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:                  CHAT_ID,
      text:                     text,
      parse_mode:               'HTML',
      disable_web_page_preview: true,
    }),
  });

  console.log('[telegram] sendMessage status:', res.status);
  if (!res.ok) {
    const errText = await res.text();
    console.error('[telegram] Errore invio notifica:', errText);
  }
}

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
    customer_name:    order.customer_name  || '',
    customer_email:   order.customer_email || '',
    customer_phone:   order.customer_phone || '',
    shipping_address: order.shipping_address || {},
    items:            order.items || [],
    subtotal:         order.subtotal || 0,
    shipping_cost:    order.shipping_cost || 0,
    total:            order.total || 0,
    stripe_session_id: order.stripe_payment_intent || '',
    payment_method:   'stripe',
    status:           'paid',
  };

  console.log('[webhook] Row da salvare:', JSON.stringify(row));
  console.log('[webhook] SUPABASE_URL:', process.env.SUPABASE_URL ? 'presente' : 'MANCANTE');
  console.log('[webhook] SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'presente' : 'MANCANTE');

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

  console.log('[webhook] Supabase status:', res.status);
  const responseText = await res.text();
  console.log('[webhook] Supabase response:', responseText);
  if (!res.ok) throw new Error('Supabase orders: ' + responseText);

  let saved;
  try { saved = JSON.parse(responseText); } catch (_) {}
  order.id = (Array.isArray(saved) ? saved[0]?.id : saved?.id) || order.id;
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
    // Non blocchiamo — tentiamo comunque notifica ed email
  }

  // ── Notifica Telegram al titolare ──────────────────────────────
  try {
    await notifyTelegram(order);
  } catch (err) {
    console.error('[stripe-webhook] notifyTelegram non raggiungibile:', err.message);
    // Non blocchiamo — la notifica è best-effort
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