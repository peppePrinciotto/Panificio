// get-settings.js — Netlify Function pubblica (no auth)
// Restituisce le impostazioni di spedizione da Supabase.
// Usata dal frontend per aggiornare CONFIG.shipping in tempo reale.
// In caso di errore restituisce i valori di default.

'use strict';

const FREE_THRESHOLD_DEFAULT = 60;
const FLAT_RATE_DEFAULT      = 8;

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type':                 'application/json',
    'Cache-Control':                'no-cache',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const defaults = { freeThreshold: FREE_THRESHOLD_DEFAULT, flatRate: FLAT_RATE_DEFAULT };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify(defaults) };
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/settings?key=in.(shipping_free_threshold,shipping_flat_rate)&select=key,value`,
      {
        headers: {
          'apikey':        SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
        },
      }
    );

    if (!res.ok) return { statusCode: 200, headers, body: JSON.stringify(defaults) };

    const rows = await res.json();
    const result = { ...defaults };

    rows.forEach(function (r) {
      if (r.key === 'shipping_free_threshold') result.freeThreshold = parseFloat(r.value) || FREE_THRESHOLD_DEFAULT;
      if (r.key === 'shipping_flat_rate')      result.flatRate      = parseFloat(r.value) || FLAT_RATE_DEFAULT;
    });

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (_) {
    return { statusCode: 200, headers, body: JSON.stringify(defaults) };
  }
};
