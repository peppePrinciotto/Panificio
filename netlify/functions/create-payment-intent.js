// create-payment-intent.js — Netlify Function
// Crea un PaymentIntent Stripe dopo aver ricalcolato il totale
// lato server leggendo i prezzi da Supabase.
//
// Env vars richieste:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

'use strict';

const Stripe = require('stripe');

const FREE_THRESHOLD_DEFAULT = 60; // fallback se Supabase non risponde
const FLAT_RATE_DEFAULT      = 8;

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type':                 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metodo non consentito' }) };
  }

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body non valido' }) };
  }

  const { items, customerData } = input;

  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nessun articolo nel carrello' }) };
  }
  if (!customerData || !customerData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email cliente mancante o non valida' }) };
  }
  if (!customerData.name || !customerData.name.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nome cliente mancante' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configurazione server incompleta' }) };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY non configurata' }) };
  }

  try {
    // ── 1. Leggi impostazioni spedizione da Supabase ───────────────
    let freeThreshold = FREE_THRESHOLD_DEFAULT;
    let flatRate      = FLAT_RATE_DEFAULT;
    try {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/settings?key=in.(shipping_free_threshold,shipping_flat_rate)&select=key,value`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY } }
      );
      if (settingsRes.ok) {
        const rows = await settingsRes.json();
        rows.forEach(function (r) {
          if (r.key === 'shipping_free_threshold') freeThreshold = parseFloat(r.value) || FREE_THRESHOLD_DEFAULT;
          if (r.key === 'shipping_flat_rate')      flatRate      = parseFloat(r.value) || FLAT_RATE_DEFAULT;
        });
      }
    } catch (_) { /* usa valori default */ }

    // ── 2. Leggi prezzi reali da Supabase ──────────────────────────
    const ids      = [...new Set(items.map(i => i.id))];
    const idsParam = ids.map(id => encodeURIComponent(id)).join(',');

    const productsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=in.(${idsParam})&select=id,price,name,weight_g`,
      {
        headers: {
          'apikey':        SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
        },
      }
    );

    if (!productsRes.ok) {
      throw new Error('Errore lettura prodotti da Supabase: ' + productsRes.status);
    }

    const products = await productsRes.json();

    // ── 2. Ricalcola totale lato server ───────────────────────────
    let subtotal = 0;
    const verifiedItems = items.map(function (cartItem) {
      const product = products.find(p => p.id === cartItem.id);
      if (!product) throw new Error(`Prodotto non trovato: ${cartItem.id}`);
      const price       = parseFloat(product.price);
      const qty         = Math.max(1, parseInt(cartItem.quantity, 10) || 1);
      const itemSubtotal = parseFloat((price * qty).toFixed(2));
      subtotal += itemSubtotal;
      return {
        id:       cartItem.id,
        name:     product.name,
        quantity: qty,
        weight_g: product.weight_g || null,
        price,
        subtotal: itemSubtotal,
      };
    });

    subtotal          = parseFloat(subtotal.toFixed(2));
    const shipping    = subtotal >= freeThreshold ? 0 : flatRate;
    const total       = parseFloat((subtotal + shipping).toFixed(2));

    // ── 3. Crea PaymentIntent Stripe ──────────────────────────────
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Serialize dati nel metadata (valori devono essere stringhe)
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(total * 100),
      currency: 'eur',
      metadata: {
        customer_name:    customerData.name.trim(),
        customer_email:   customerData.email.trim(),
        customer_phone:   (customerData.phone || '').trim(),
        customer_address: JSON.stringify(customerData.address || {}),
        items_data:       JSON.stringify(verifiedItems),
        subtotal:         String(subtotal),
        shipping_cost:    String(shipping),
        total:            String(total),
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        total,
        shipping,
      }),
    };

  } catch (err) {
    console.error('[create-payment-intent] Errore:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Errore durante la creazione del pagamento' }),
    };
  }
};
