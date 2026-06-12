// resolve-map.js — Netlify Function pubblica (no auth)
// Converte un link Google Maps (anche breve, es. https://maps.app.goo.gl/...)
// in un URL embeddabile in un iframe.
//
// I link brevi maps.app.goo.gl NON possono stare in un iframe
// (Google imposta X-Frame-Options: sameorigin). Questa funzione segue
// il redirect lato server, estrae le coordinate e restituisce un URL
// nella forma ...&output=embed che è invece embeddabile senza API key.
//
// Uso: GET /.netlify/functions/resolve-map?url=<link>
// Risposta: { embedUrl, lat, lng }

'use strict';

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type':                 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const rawUrl = (event.queryStringParameters || {}).url;
  if (!rawUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parametro url mancante' }) };
  }

  try {
    // Segue i redirect lato server (il browser non può per via di CORS)
    const res = await fetch(rawUrl, {
      redirect: 'follow',
      headers: {
        // User-Agent desktop per evitare pagine di consenso mobile
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });

    const finalUrl = res.url || '';

    // Estrae le coordinate: prima il pin preciso (!3d<lat>!4d<lng>),
    // poi il centro mappa (@lat,lng)
    let lat, lng;
    let m = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m) { lat = m[1]; lng = m[2]; }
    if (!lat) {
      m = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m) { lat = m[1]; lng = m[2]; }
    }

    if (!lat || !lng) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({ error: 'Impossibile estrarre le coordinate dal link', finalUrl }),
      };
    }

    // Costruisce un URL nel formato classico /maps/embed?pb=... — è l'unico
    // formato embeddabile in iframe senza API key (Google ha dismesso
    // ?output=embed, che ora restituisce X-Frame-Options: SAMEORIGIN).
    // !2d = longitudine, !3d = latitudine, !1d = scala (zoom).
    const ts = Date.now();
    const embedUrl =
      'https://www.google.com/maps/embed?pb=' +
      '!1m18!1m12!1m3!1d3139.30' +
      `!2d${lng}!3d${lat}` +
      '!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1' +
      '!3m3!1m2!1s0x0%3A0x0!2s' +
      `!5e0!3m2!1sit!2sit!4v${ts}!5m2!1sit!2sit`;

    return { statusCode: 200, headers, body: JSON.stringify({ embedUrl, lat, lng }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
