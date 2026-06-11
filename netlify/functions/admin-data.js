// admin-data.js — Netlify Function protetta per le operazioni admin
// Usa Supabase REST API con service_role key (non esposta al client)
// Autenticazione: header Authorization: Bearer <SHA256_password>
//
// Env vars richieste su Netlify:
//   SUPABASE_URL              — es. https://xyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — dalla dashboard Supabase > Settings > API
//   ADMIN_HASH                — SHA-256 della password admin
//
// Schema Supabase richiesto:
//
//   CREATE TABLE products (
//     id TEXT PRIMARY KEY,
//     name TEXT NOT NULL,
//     description TEXT DEFAULT '',
//     price NUMERIC NOT NULL,
//     weight_g INTEGER,
//     available BOOLEAN DEFAULT true,
//     stock INTEGER,
//     image_url TEXT DEFAULT '',
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     updated_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "anon read" ON products FOR SELECT USING (true);
//
//   CREATE TABLE orders (
//     id TEXT PRIMARY KEY,
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     customer JSONB NOT NULL DEFAULT '{}',
//     items JSONB NOT NULL DEFAULT '[]',
//     total FLOAT DEFAULT 0,
//     shipping FLOAT DEFAULT 0,
//     payment_method TEXT DEFAULT '',
//     status TEXT DEFAULT 'paid',
//     shipped_at TIMESTAMPTZ
//   );
//   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
//   -- Nessuna policy pubblica: solo service_role può leggere/scrivere ordini

'use strict';

// ============================================================
// Helper: chiamata a Supabase REST API via fetch nativo (Node 18+)
// ============================================================
async function supabaseRequest(method, path, body) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const url = SUPABASE_URL + '/rest/v1' + path;

  const opts = {
    method,
    headers: {
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'apikey':        SERVICE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        method === 'DELETE' ? 'return=minimal' : 'return=representation',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { if (text.trim()) data = JSON.parse(text); } catch (_) { data = text; }

  return { status: res.status, data };
}

// ============================================================
// Conversione prodotto JS (camelCase) → riga Supabase (snake_case)
// ============================================================
function productToRow(p, includeId) {
  const row = {
    name:        p.name,
    description: p.description || '',
    price:       parseFloat(p.price || 0),
    weight_g:    (p.weightG !== undefined && p.weightG !== null && p.weightG !== '')
                   ? parseInt(p.weightG, 10) : null,
    stock:       (p.stock !== undefined && p.stock !== null && p.stock !== '')
                   ? parseInt(p.stock, 10) : null,
    available:   p.available !== false,
    image_url:   p.imageUrl || p.image_url || '',
  };
  if (includeId && p.id) row.id = p.id;
  return row;
}

// ============================================================
// Conversione riga Supabase → prodotto JS
// ============================================================
function rowToProduct(r) {
  return {
    id:          r.id,
    name:        r.name,
    description: r.description || '',
    price:       r.price,
    weightG:     r.weight_g,
    stock:       r.stock,
    available:   r.available !== false,
    imageUrl:    r.image_url || '',
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

// ============================================================
// Conversione riga ordine Supabase → oggetto JS
// ============================================================
function rowToOrder(r) {
  // Compatibile con schema nuovo (colonne piatte) e vecchio (jsonb customer)
  const legacyCustomer = r.customer || {};
  return {
    id:              r.id,
    date:            r.created_at,
    createdAt:       r.created_at,
    customerName:    r.customer_name  || legacyCustomer.name  || '',
    customerEmail:   r.customer_email || legacyCustomer.email || '',
    customerPhone:   r.customer_phone || legacyCustomer.phone || '',
    shippingAddress: r.shipping_address || legacyCustomer.address || {},
    customer:        legacyCustomer,
    items:           r.items      || [],
    subtotal:        r.subtotal   || 0,
    total:           r.total      || 0,
    shipping:        r.shipping_cost || r.shipping || 0,
    paymentMethod:   r.payment_method || '',
    status:          r.status     || 'paid',
    shippedAt:       r.shipped_at || null,
  };
}

// ============================================================
// Handler principale
// ============================================================
exports.handler = async function (event) {
  // ── Log di diagnostica variabili d'ambiente ──────────────────
  console.log('ALL ENV KEYS:', Object.keys(process.env).filter(k =>
    k.includes('SUPA') || k.includes('ADMIN') || k.includes('RESEND')
  ));
  console.log('ENV CHECK:', {
    supabaseUrl:  process.env.SUPABASE_URL              ? 'presente' : 'MANCANTE',
    serviceRole:  process.env.SUPABASE_SERVICE_ROLE_KEY ? 'presente' : 'MANCANTE',
    adminHash:    process.env.ADMIN_HASH                ? 'presente' : 'MANCANTE',
  });

  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type':                 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // ── Verifica token admin ──────────────────────────────────────
  const authHeader = (event.headers['authorization'] || event.headers['Authorization'] || '').trim();
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const ADMIN_HASH = process.env.ADMIN_HASH;

  if (!ADMIN_HASH) {
    console.error('ADMIN_HASH non configurato come variabile d\'ambiente su Netlify');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configurazione server incompleta: ADMIN_HASH mancante' }),
    };
  }

  console.log('Token ricevuto (primi 8):', token    ? token.substring(0, 8)     : 'NULLO');
  console.log('Hash atteso  (primi 8):', ADMIN_HASH ? ADMIN_HASH.substring(0, 8) : 'NULLO');

  if (!token || token !== ADMIN_HASH) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Non autorizzato — credenziali non valide' }),
    };
  }

  // ── Routing ──────────────────────────────────────────────────
  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  const action = params.action;

  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch (_) {}

  // ── GET auth-check ────────────────────────────────────────────
  // Endpoint leggero solo per validare il token — nessuna chiamata a Supabase
  if (method === 'GET' && action === 'auth-check') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  // ── Variabili Supabase — URL pubblica con fallback hardcoded ──
  const SUPABASE_URL = process.env.SUPABASE_URL
    || 'https://oyzlsznibhjnpejzkncw.supabase.co';
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY non impostata');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Configurazione server incompleta: SUPABASE_SERVICE_ROLE_KEY mancante' }),
    };
  }

  try {

    // ── GET products ─────────────────────────────────────────────
    if (method === 'GET' && action === 'products') {
      const res = await supabaseRequest('GET', '/products?select=*&order=created_at.asc');
      if (res.status >= 400) {
        console.error('Supabase GET /products errore:', res.status, res.data);
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify((res.data || []).map(rowToProduct)) };
    }

    // ── POST product (crea nuovo) ─────────────────────────────────
    if (method === 'POST' && action === 'product') {
      const row        = productToRow(body, true);
      row.created_at   = new Date().toISOString();
      row.updated_at   = new Date().toISOString();
      const res = await supabaseRequest('POST', '/products', row);
      if (res.status >= 400) {
        console.error('Supabase POST /products errore:', res.status, res.data);
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      const created = Array.isArray(res.data) ? res.data[0] : res.data;
      return { statusCode: 201, headers, body: JSON.stringify(created ? rowToProduct(created) : {}) };
    }

    // ── PUT product (aggiorna esistente) ──────────────────────────
    if (method === 'PUT' && action === 'product') {
      const id = params.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parametro id mancante' }) };
      const row      = productToRow(body, false);
      row.updated_at = new Date().toISOString();
      const res = await supabaseRequest('PATCH', `/products?id=eq.${encodeURIComponent(id)}`, row);
      if (res.status >= 400) {
        console.error('Supabase PATCH /products errore:', res.status, res.data);
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      const updated = Array.isArray(res.data) ? res.data[0] : res.data;
      return { statusCode: 200, headers, body: JSON.stringify(updated ? rowToProduct(updated) : {}) };
    }

    // ── DELETE product ────────────────────────────────────────────
    if (method === 'DELETE' && action === 'product') {
      const id = params.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parametro id mancante' }) };
      const res = await supabaseRequest('DELETE', `/products?id=eq.${encodeURIComponent(id)}`);
      if (res.status >= 400) {
        console.error('Supabase DELETE /products errore:', res.status, res.data);
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── GET orders ────────────────────────────────────────────────
    if (method === 'GET' && action === 'orders') {
      let path = '/orders?select=*&order=created_at.desc';
      if (params.status && params.status !== 'all') {
        path += `&status=eq.${encodeURIComponent(params.status)}`;
      }
      const res = await supabaseRequest('GET', path);
      if (res.status >= 400) {
        console.error('Supabase GET /orders errore:', res.status, res.data);
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify((res.data || []).map(rowToOrder)) };
    }

    // ── PUT order status ──────────────────────────────────────────
    if (method === 'PUT' && action === 'order-status') {
      const id = params.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parametro id mancante' }) };
      const update = { status: body.status };
      if (body.status === 'shipped') update.shipped_at = new Date().toISOString();
      const res = await supabaseRequest('PATCH', `/orders?id=eq.${encodeURIComponent(id)}`, update);
      if (res.status >= 400) {
        console.error('Supabase PATCH /orders errore:', res.status, res.data);
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── POST seed-products ────────────────────────────────────────
    if (method === 'POST' && action === 'seed-products') {
      const checkRes = await supabaseRequest('GET', '/products?select=id&limit=1');
      if (checkRes.data && Array.isArray(checkRes.data) && checkRes.data.length > 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ seeded: false, message: 'Tabella già popolata' }) };
      }
      const defaultProducts = body.products || [];
      let count = 0;
      for (const p of defaultProducts) {
        const row        = productToRow(p, true);
        row.created_at   = new Date().toISOString();
        row.updated_at   = new Date().toISOString();
        const res = await supabaseRequest('POST', '/products', row);
        if (res.status < 400) count++;
        else console.error('Seed product errore:', res.status, res.data);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ seeded: true, count }) };
    }

    // ── GET settings ──────────────────────────────────────────────
    if (method === 'GET' && action === 'settings') {
      const res = await supabaseRequest('GET', '/settings?select=key,value');
      if (res.status >= 400) {
        return { statusCode: res.status, headers, body: JSON.stringify({ error: res.data }) };
      }
      const map = {};
      (res.data || []).forEach(row => { map[row.key] = row.value; });
      return { statusCode: 200, headers, body: JSON.stringify(map) };
    }

    // ── PUT settings ──────────────────────────────────────────────
    if (method === 'PUT' && action === 'settings') {
      const { key, value } = body;
      if (!key) return { statusCode: 400, headers, body: JSON.stringify({ error: 'key mancante' }) };

      // Upsert: inserisce o aggiorna in base alla chiave primaria (key)
      const SUPABASE_URL2 = process.env.SUPABASE_URL || 'https://oyzlsznibhjnpejzkncw.supabase.co';
      const SERVICE_KEY2  = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const upsertRes = await fetch(SUPABASE_URL2 + '/rest/v1/settings', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + SERVICE_KEY2,
          'apikey':        SERVICE_KEY2,
          'Content-Type':  'application/json',
          'Prefer':        'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ key, value: String(value) }),
      });

      if (!upsertRes.ok) {
        const errText = await upsertRes.text();
        console.error('Supabase upsert settings errore:', upsertRes.status, errText);
        return { statusCode: upsertRes.status, headers, body: JSON.stringify({ error: errText }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Azione non riconosciuta: ' + action }) };

  } catch (err) {
    console.error('Errore dettagliato admin-data.js:', err.message, err.stack);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Errore interno: ' + err.message }) };
  }
};
