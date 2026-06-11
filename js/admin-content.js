// admin-content.js — Gestione contenuti del sito nel pannello admin
// Legge/scrive su Supabase via /.netlify/functions/admin-data (action=settings)

(function () {
  'use strict';

  const API = '/.netlify/functions/admin-data';

  const DAYS = [
    { key: 'hours_monday',    label: 'Lunedì'    },
    { key: 'hours_tuesday',   label: 'Martedì'   },
    { key: 'hours_wednesday', label: 'Mercoledì' },
    { key: 'hours_thursday',  label: 'Giovedì'   },
    { key: 'hours_friday',    label: 'Venerdì'   },
    { key: 'hours_saturday',  label: 'Sabato'    },
    { key: 'hours_sunday',    label: 'Domenica'  },
  ];

  const DEFAULT_HOURS = '06:00 – 13:30';
  const DEFAULT_HOURS_SUNDAY = '06:00 – 12:00';

  function authHeaders() {
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + (sessionStorage.getItem('admin_token') || ''),
    };
  }

  function apiFetch(method, params, body) {
    const url  = API + '?' + new URLSearchParams(params).toString();
    const opts = { method, headers: authHeaders() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Errore API (' + res.status + ')');
        return data;
      });
    });
  }

  function getSettings() {
    return apiFetch('GET', { action: 'settings' });
  }

  function saveSetting(key, value) {
    return apiFetch('PUT', { action: 'settings' }, { key, value });
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  function val(settings, key, fallback) {
    return (settings[key] !== undefined && settings[key] !== null)
      ? sanitize(settings[key])
      : (fallback || '');
  }

  // ============================================================
  // Render sezione contenuti
  // ============================================================
  function renderContent(settings) {
    const container = document.getElementById('content-content');
    if (!container) return;
    container.style.display = '';

    const orariRows = DAYS.map(function (d) {
      const defaultVal = d.key === 'hours_sunday' ? DEFAULT_HOURS_SUNDAY : DEFAULT_HOURS;
      return `
        <tr>
          <td style="padding:6px 0; width:110px; color:var(--color-text-muted); font-size:0.88rem;">${d.label}</td>
          <td style="padding:6px 0;">
            <input type="text" id="${d.key}"
                   value="${val(settings, d.key, defaultVal)}"
                   placeholder="${defaultVal}"
                   style="width:100%; padding:0.5rem 0.75rem; border:1px solid var(--color-border);
                          border-radius:4px; font-size:0.9rem;" />
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;
                  margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
        <h2 style="font-family:var(--font-display); font-size:1.2rem; color:var(--color-espresso);">
          Contenuti del sito
        </h2>
      </div>

      <div id="content-feedback" role="alert" style="display:none; margin-bottom:1rem;"></div>

      <form id="content-form" novalidate>

        <!-- Informazioni di contatto -->
        <div class="panel" style="margin-bottom:1.5rem;">
          <div class="panel-header">
            <span class="panel-title">Informazioni di contatto</span>
          </div>
          <div class="panel-body">

            <div class="form-row">
              <div class="form-group">
                <label for="phone_primary">Telefono principale</label>
                <input type="tel" id="phone_primary"
                       value="${val(settings, 'phone_primary')}"
                       placeholder="+39 377 5790396" />
              </div>
              <div class="form-group">
                <label for="phone_secondary">Telefono secondario</label>
                <input type="tel" id="phone_secondary"
                       value="${val(settings, 'phone_secondary')}"
                       placeholder="+39 327 9586317" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="whatsapp_number">Numero WhatsApp</label>
                <input type="tel" id="whatsapp_number"
                       value="${val(settings, 'whatsapp_number')}"
                       placeholder="393775790396 (solo cifre, con prefisso)" />
                <span style="font-size:0.78rem; color:var(--color-text-muted); margin-top:0.2rem; display:block;">
                  Formato: 39XXXXXXXXXX (senza + o spazi)
                </span>
              </div>
              <div class="form-group">
                <label for="email_contact">Email di contatto</label>
                <input type="email" id="email_contact"
                       value="${val(settings, 'email_contact')}"
                       placeholder="info@panificioroccafiorita.it" />
              </div>
            </div>

            <div class="form-group">
              <label for="address">Indirizzo</label>
              <input type="text" id="address"
                     value="${val(settings, 'address')}"
                     placeholder="Via Pozzo Danile n.12, 13, 14 — Sant'Angelo di Brolo, 98060 (ME)" />
            </div>

            <div class="form-group">
              <label for="maps_embed_url">Link Google Maps (embed URL)</label>
              <input type="text" id="maps_embed_url"
                     value="${val(settings, 'maps_embed_url')}"
                     placeholder="https://www.google.com/maps/embed?pb=..." />
              <span style="font-size:0.78rem; color:var(--color-text-muted); margin-top:0.2rem; display:block;">
                Vai su Google Maps → Condividi → Incorpora una mappa → copia l'URL dall'attributo src dell'iframe
              </span>
            </div>

          </div>
        </div>

        <!-- Orari di apertura -->
        <div class="panel" style="margin-bottom:1.5rem;">
          <div class="panel-header">
            <span class="panel-title">Orari di apertura</span>
          </div>
          <div class="panel-body">
            <table style="width:100%; border-collapse:collapse;">
              <tbody>
                ${orariRows}
              </tbody>
            </table>
            <span style="font-size:0.78rem; color:var(--color-text-muted); margin-top:0.75rem; display:block;">
              Scrivi "Chiuso" per i giorni di chiusura
            </span>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
          <button type="submit" class="btn-admin btn-primary" id="content-save-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Salva tutto
          </button>
        </div>

      </form>`;

    document.getElementById('content-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleSave();
    });
  }

  // ============================================================
  // Salvataggio di tutti i campi
  // ============================================================
  function handleSave() {
    const btn = document.getElementById('content-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio…'; }

    const keys = [
      'phone_primary', 'phone_secondary', 'whatsapp_number',
      'email_contact', 'address', 'maps_embed_url',
      'hours_monday', 'hours_tuesday', 'hours_wednesday',
      'hours_thursday', 'hours_friday', 'hours_saturday', 'hours_sunday',
    ];

    const saves = keys.map(function (key) {
      const el = document.getElementById(key);
      const value = el ? el.value.trim() : '';
      return saveSetting(key, value);
    });

    Promise.all(saves)
      .then(function () {
        showFeedback('Contenuti salvati. Il sito li mostrerà al prossimo caricamento.', true);
      })
      .catch(function (err) {
        showFeedback('Errore durante il salvataggio: ' + err.message, false);
      })
      .finally(function () {
        if (btn) {
          btn.disabled    = false;
          btn.textContent = 'Salva tutto';
          // Ripristina SVG
          btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg> Salva tutto`;
        }
      });
  }

  function showFeedback(message, success) {
    const el = document.getElementById('content-feedback');
    if (!el) return;
    el.textContent     = message;
    el.style.display   = 'block';
    el.style.padding   = '0.6rem 0.9rem';
    el.style.borderRadius = '4px';
    el.style.fontSize  = '0.88rem';
    if (success) {
      el.style.background = '#F0FDF4';
      el.style.border     = '1px solid #86EFAC';
      el.style.color      = '#166534';
    } else {
      el.style.background = '#FEF2F2';
      el.style.border     = '1px solid #FCA5A5';
      el.style.color      = '#991B1B';
    }
    setTimeout(function () { el.style.display = 'none'; }, 5000);
  }

  // ============================================================
  // Caricamento dati da Supabase
  // ============================================================
  function loadContent() {
    const container = document.getElementById('content-content');
    if (!container) return;
    container.style.display = '';
    container.innerHTML = '<div style="padding:2rem; color:var(--color-text-muted);">Caricamento…</div>';

    getSettings()
      .then(renderContent)
      .catch(function (err) {
        container.innerHTML = `<div class="empty-state" style="color:#c0392b;">
          <p>Errore caricamento contenuti: ${err.message}</p>
          <button class="btn-admin btn-ghost btn-sm" onclick="location.reload()">Riprova</button>
        </div>`;
      });
  }

  // ============================================================
  // Punto di ingresso
  // ============================================================
  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'content') {
      loadContent();
    }
  });

  document.addEventListener('admin:ready', function () {
    const section = document.getElementById('section-content');
    if (section && section.style.display !== 'none') {
      loadContent();
    }
  });

}());
