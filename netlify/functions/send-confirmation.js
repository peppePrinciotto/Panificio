// send-confirmation.js — Netlify Function
// Riceve un oggetto ordine completo e invia l'email di conferma
// al cliente via Resend. Il salvataggio su Supabase è delegato
// a stripe-webhook.js (per pagamenti Stripe) o al chiamante.
//
// Env vars richieste:
//   RESEND_API_KEY

'use strict';

const https = require('https');

const RESEND_KEY = process.env.RESEND_API_KEY;

// ============================================================
// Helper HTTP per Resend
// ============================================================
function httpsPost(hostname, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const headers = Object.assign(
      {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr).toString(),
      },
      extraHeaders || {}
    );

    const req = https.request(
      { hostname, port: 443, method: 'POST', path, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let parsed = null;
          try { if (data.trim()) parsed = JSON.parse(data); } catch (_) {}
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ============================================================
// Invia email via Resend
// ============================================================
async function sendEmailViaResend(order) {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY non configurato');

  const res = await httpsPost(
    'api.resend.com',
    '/emails',
    {
      from:    'onboarding@resend.dev',       // ← MODIFICA QUI: mittente (es. 'Panificio Roccafiorita <noreply@tuodominio.it>')
      to:      [order.customer.email],
      subject: 'Grazie per il tuo ordine — Panificio Roccafiorita', // ← MODIFICA QUI: oggetto email
      html:    buildEmailHtml(order),
    },
    { 'Authorization': 'Bearer ' + RESEND_KEY }
  );

  if (res.status >= 400) {
    throw new Error('Resend: ' + JSON.stringify(res.data));
  }
  return res.data;
}

// ============================================================
// Template email HTML
// ============================================================
function buildEmailHtml(order) {
  const c         = order.customer || {};
  const addr      = c.address     || {};
  const firstName = (c.name || 'Cliente').split(' ')[0];

  const itemRows = (order.items || []).map((i) => `
    <tr>
      <td style="padding:12px 16px;font-size:14px;color:#1C1009;border-bottom:1px solid #F5EFE0;">${esc(i.name || '—')}</td>
      <td style="padding:12px 16px;text-align:center;font-size:14px;color:#1C1009;border-bottom:1px solid #F5EFE0;">${Number(i.quantity || 1)} conf.</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;color:#7A6550;border-bottom:1px solid #F5EFE0;">€${Number(i.price || 0).toFixed(2)}</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;font-weight:600;color:#1C1009;border-bottom:1px solid #F5EFE0;">€${Number(i.subtotal || 0).toFixed(2)}</td>
    </tr>`).join('');

  const shippingCell = (order.shipping_cost === 0 || order.shipping_cost === '0')
    ? '<span style="color:#2D7A47;font-weight:600;">Gratuita</span>'
    : `€${Number(order.shipping_cost || 0).toFixed(2)}`;

  const province = addr.province ? ` (${esc(addr.province)})` : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Conferma ordine #${esc(order.id)}</title>
</head>
<body style="margin:0;padding:0;background:#F5EFE0;font-family:Georgia,'Times New Roman',serif;color:#1C1009;">

  <!-- ── HEADER ── -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1C1009;">
    <tr>
      <td align="center" style="padding:36px 24px;">
        <div style="font-size:10px;letter-spacing:5px;text-transform:uppercase;color:#7A6550;margin-bottom:8px;">FORNO ARTIGIANALE SICILIANO</div>
        <div style="font-size:32px;font-weight:bold;color:#A07830;letter-spacing:3px;line-height:1;">Panificio</div>
        <div style="font-size:20px;color:#C9A55A;letter-spacing:2px;margin-top:4px;">Roccafiorita</div>
        <div style="width:56px;height:2px;background:#A07830;margin:18px auto 0;"></div>
      </td>
    </tr>
  </table>

  <!-- ── BODY ── -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Saluto -->
          <tr>
            <td style="padding:40px 8px 0;">
              <!-- MODIFICA QUI: saluto personalizzato (es. "Cara" per clienti donna) -->
              <p style="font-size:22px;color:#3D2314;margin:0 0 16px;line-height:1.3;">Caro ${esc(firstName)},</p>
              <!-- MODIFICA QUI: messaggio principale (riga di conferma) -->
              <p style="font-size:15px;line-height:1.85;color:#3D2314;margin:0 0 10px;">
                il tuo ordine è confermato!
              </p>
              <!-- MODIFICA QUI: messaggio secondario (descrizione del panificio) -->
              <p style="font-size:15px;line-height:1.85;color:#5C4030;margin:0 0 32px;">
                Siamo già al lavoro per prepararti i nostri prodotti con la stessa dedizione
                di sempre. Ogni pezzo viene impastato e cotto a mano nella nostra bottega
                a Sant'Angelo di Brolo, seguendo ricette tramandate di generazione in generazione
                nella nostra famiglia.
              </p>
            </td>
          </tr>

          <!-- Intestazione tabella ordine -->
          <tr>
            <td style="padding:0 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#1C1009;padding:13px 16px;border-radius:4px 4px 0 0;">
                    <span style="color:#A07830;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Riepilogo ordine #${esc(order.id)}</span>
                  </td>
                </tr>
              </table>

              <!-- Tabella articoli -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E8DCC8;border-top:none;">
                <thead>
                  <tr style="background:#F5EFE0;">
                    <th style="padding:10px 16px;text-align:left;font-size:11px;color:#7A6550;text-transform:uppercase;letter-spacing:1px;font-weight:normal;border-bottom:1px solid #E8DCC8;">Prodotto</th>
                    <th style="padding:10px 16px;text-align:center;font-size:11px;color:#7A6550;text-transform:uppercase;letter-spacing:1px;font-weight:normal;border-bottom:1px solid #E8DCC8;">Conf.</th>
                    <th style="padding:10px 16px;text-align:right;font-size:11px;color:#7A6550;text-transform:uppercase;letter-spacing:1px;font-weight:normal;border-bottom:1px solid #E8DCC8;">Prezzo</th>
                    <th style="padding:10px 16px;text-align:right;font-size:11px;color:#7A6550;text-transform:uppercase;letter-spacing:1px;font-weight:normal;border-bottom:1px solid #E8DCC8;">Subtotale</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows || '<tr><td colspan="4" style="padding:12px 16px;color:#7A6550;font-style:italic;">Nessun articolo</td></tr>'}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding:10px 16px;text-align:right;font-size:13px;color:#7A6550;border-top:1px solid #E8DCC8;">Subtotale prodotti</td>
                    <td style="padding:10px 16px;text-align:right;font-size:13px;color:#3D2314;border-top:1px solid #E8DCC8;">€${Number(order.subtotal || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding:10px 16px;text-align:right;font-size:13px;color:#7A6550;">Spedizione</td>
                    <td style="padding:10px 16px;text-align:right;font-size:13px;color:#3D2314;">${shippingCell}</td>
                  </tr>
                  <tr style="background:#F5EFE0;">
                    <td colspan="3" style="padding:14px 16px;text-align:right;font-size:17px;font-weight:bold;color:#1C1009;">Totale</td>
                    <td style="padding:14px 16px;text-align:right;font-size:17px;font-weight:bold;color:#A07830;">€${Number(order.total || 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Indirizzo di spedizione -->
          <tr>
            <td style="padding:24px 8px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #E8DCC8;border-radius:4px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7A6550;margin-bottom:10px;">Indirizzo di spedizione</div>
                    <div style="font-size:15px;color:#3D2314;line-height:1.75;">
                      <strong>${esc(c.name || '')}</strong><br>
                      ${esc(addr.street || '')}<br>
                      ${esc(addr.zip || '')} ${esc(addr.city || '')}${province}<br>
                      Italia
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nota tempi di consegna -->
          <tr>
            <td style="padding:20px 8px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E8DCC8;border-left:3px solid #A07830;border-radius:0 4px 4px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <!-- MODIFICA QUI: messaggio finale con tempi di spedizione -->
                    <p style="margin:0;font-size:14px;color:#3D2314;line-height:1.85;">
                      <strong>Tempi di consegna stimati:</strong> i tuoi prodotti vengono preparati
                      con cura e affidati al corriere entro <strong>2–3 giorni lavorativi</strong>.
                      Ti invieremo un messaggio non appena il pacco è in partenza.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contatti -->
          <tr>
            <td style="padding:24px 8px 0;">
              <p style="font-size:14px;color:#7A6550;line-height:1.85;margin:0;">
                Per qualsiasi necessità siamo a tua disposizione:<br>
                <a href="mailto:info@panificioroccafiorita.it" style="color:#A07830;text-decoration:none;">info@panificioroccafiorita.it</a>
                &nbsp;·&nbsp;
                <a href="tel:+393775790396" style="color:#A07830;text-decoration:none;">+39 377 5790396</a>
              </p>
            </td>
          </tr>

          <!-- Firma -->
          <tr>
            <td style="padding:32px 8px 48px;">
              <p style="font-size:16px;color:#3D2314;line-height:1.8;margin:0 0 6px;">
                Grazie per aver scelto il Panificio Roccafiorita.
              </p>
              <p style="font-size:15px;color:#A07830;font-style:italic;margin:0 0 18px;">
                "Il pane fatto con amore, consegnato a casa tua."
              </p>
              <p style="font-size:14px;color:#3D2314;margin:0;line-height:1.7;">
                Con affetto,<br>
                <strong>Il team del Panificio Roccafiorita</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- ── FOOTER ── -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1C1009;">
    <tr>
      <td align="center" style="padding:28px 24px;">
        <!-- MODIFICA QUI: indirizzo panificio nel footer -->
        <p style="margin:0 0 4px;font-size:12px;color:#7A6550;line-height:1.9;">
          Panificio Roccafiorita · Via Pozzo Danile n.12–14 · Sant'Angelo di Brolo (ME) 98060
        </p>
        <!-- MODIFICA QUI: P.IVA nel footer -->
        <p style="margin:0 0 10px;font-size:12px;color:#7A6550;">
          P.IVA 00000000000
        </p>
        <p style="margin:0;font-size:11px;color:#4A3824;line-height:1.6;">
          Hai ricevuto questa email perché hai effettuato un ordine su panificioroccafiorita.it
        </p>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// HTML escape
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// Handler principale
// ============================================================
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
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body non valido (JSON malformato)' }) };
  }

  // Validazione minima
  if (!input.customer || !input.customer.email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Dati cliente mancanti' }) };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Nessun articolo nell'ordine" }) };
  }

  // Invia email via Resend
  try {
    await sendEmailViaResend(input);
  } catch (err) {
    console.error('[send-confirmation] Resend:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Impossibile inviare la email di conferma.' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, orderId: input.id }),
  };
};
