// send-confirmation.js — Netlify Function
// Riceve un oggetto ordine completo e invia l'email di conferma
// al cliente via Gmail (Nodemailer).
//
// Env vars richieste:
//   GMAIL_USER         — indirizzo Gmail mittente (es. panificio@gmail.com)
//   GMAIL_APP_PASSWORD — App Password Google (non la password normale)

'use strict';

// ============================================================
// Invia email via Gmail (Nodemailer)
// ============================================================
async function sendEmailViaGmail(order) {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from:    '"Panificio Roccafiorita" <' + process.env.GMAIL_USER + '>',
    to:      order.customer?.email || order.customer_email,
    subject: 'Grazie per il tuo ordine — Panificio Roccafiorita',
    html:    buildEmailHtml(order),
  });
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
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#6B3A22;">
    <tr>
      <td align="center" style="padding:40px 24px 36px;">
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:12px;
                    font-weight:400;letter-spacing:6px;text-transform:uppercase;
                    color:#C9A55A;margin-bottom:8px;">
          Panificio
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:36px;
                    font-weight:700;color:#FDFAF4;letter-spacing:2px;line-height:1.1;">
          Roccafiorita
        </div>
        <div style="width:48px;height:2px;background:#C9A55A;margin:16px auto 0;"></div>
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
              <p style="font-size:22px;color:#3D2314;margin:0 0 16px;line-height:1.3;">Caro ${esc(firstName)},</p>
              <p style="font-size:15px;line-height:1.85;color:#3D2314;margin:0 0 10px;">
                il tuo ordine è confermato!
              </p>
              <p style="font-size:15px;line-height:1.85;color:#5C4030;margin:0 0 32px;">
                Siamo già al lavoro per prepararti i nostri prodotti con la stessa dedizione di sempre.
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
        <p style="margin:0 0 4px;font-size:12px;color:#7A6550;line-height:1.9;">
          Panificio Roccafiorita · Via Pozzo Danile n.12–14 · Sant'Angelo di Brolo (ME) 98060
        </p>
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

  // Normalizza struttura ordine — supporta formato piatto
  // (da stripe-webhook) e formato nested (da checkout diretto)
  if (!input.customer && input.customer_name) {
    input.customer = {
      name:    input.customer_name  || '',
      email:   input.customer_email || '',
      phone:   input.customer_phone || '',
      address: input.shipping_address || {},
    };
  }

  // Validazione minima
  if (!input.customer?.email && !input.customer_email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Dati cliente mancanti' }) };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Nessun articolo nell'ordine" }) };
  }

  // Invia email via Gmail
  try {
    await sendEmailViaGmail(input);
  } catch (err) {
    console.error('[send-confirmation] Errore Gmail:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, orderId: input.id }),
  };
};
