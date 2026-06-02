// admin-settings.js — Impostazioni spedizione nel pannello admin
// Legge/scrive su Supabase via /.netlify/functions/admin-data

(function () {
  'use strict';

  const API = '/.netlify/functions/admin-data';

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

  // ============================================================
  // Render sezione impostazioni
  // ============================================================
  function renderSettings(settings) {
    const container = document.getElementById('settings-content');
    if (!container) return;

    const threshold = settings.shipping_free_threshold || '60';
    const flatRate  = settings.shipping_flat_rate      || '8';

    container.innerHTML = `
      <h2 style="font-family:var(--font-display); font-size:1.2rem; color:var(--color-espresso); margin-bottom:1.5rem;">
        Impostazioni spedizione
      </h2>

      <div id="settings-feedback" role="alert" style="display:none; margin-bottom:1rem;"></div>

      <div class="form-section" style="max-width:480px;">
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label for="s-free-threshold" style="display:block; margin-bottom:0.4rem; font-size:0.88rem; color:var(--color-text-muted);">
            Spedizione gratuita sopra (€)
          </label>
          <input type="number" id="s-free-threshold"
                 value="${sanitize(threshold)}"
                 min="0" step="0.01"
                 style="width:100%; padding:0.6rem 0.75rem; border:1px solid var(--color-border); border-radius:4px; font-size:0.95rem;" />
          <span style="font-size:0.78rem; color:var(--color-text-muted); display:block; margin-top:0.3rem;">
            Ordini superiori a questa cifra ricevono la spedizione gratuita.
          </span>
        </div>

        <div class="form-group" style="margin-bottom:1.5rem;">
          <label for="s-flat-rate" style="display:block; margin-bottom:0.4rem; font-size:0.88rem; color:var(--color-text-muted);">
            Costo spedizione fisso (€)
          </label>
          <input type="number" id="s-flat-rate"
                 value="${sanitize(flatRate)}"
                 min="0" step="0.01"
                 style="width:100%; padding:0.6rem 0.75rem; border:1px solid var(--color-border); border-radius:4px; font-size:0.95rem;" />
          <span style="font-size:0.78rem; color:var(--color-text-muted); display:block; margin-top:0.3rem;">
            Applicato agli ordini al di sotto della soglia gratuita.
          </span>
        </div>

        <button class="btn-admin btn-primary" id="s-save-btn">
          Salva impostazioni
        </button>
      </div>`;

    document.getElementById('s-save-btn').addEventListener('click', handleSave);
  }

  function handleSave() {
    const btn       = document.getElementById('s-save-btn');
    const threshold = parseFloat(document.getElementById('s-free-threshold').value);
    const flatRate  = parseFloat(document.getElementById('s-flat-rate').value);

    if (isNaN(threshold) || threshold < 0) {
      showFeedback('Soglia spedizione gratuita non valida.', false);
      return;
    }
    if (isNaN(flatRate) || flatRate < 0) {
      showFeedback('Costo spedizione non valido.', false);
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Salvataggio…';

    Promise.all([
      saveSetting('shipping_free_threshold', String(threshold)),
      saveSetting('shipping_flat_rate',      String(flatRate)),
    ])
      .then(function () {
        showFeedback('Impostazioni salvate.', true);
      })
      .catch(function (err) {
        showFeedback('Errore: ' + err.message, false);
      })
      .finally(function () {
        btn.disabled    = false;
        btn.textContent = 'Salva impostazioni';
      });
  }

  function showFeedback(message, success) {
    const el = document.getElementById('settings-feedback');
    if (!el) return;
    el.textContent  = message;
    el.style.display = 'block';
    el.style.padding = '0.6rem 0.9rem';
    el.style.borderRadius = '4px';
    el.style.fontSize = '0.88rem';
    if (success) {
      el.style.background = '#F0FDF4';
      el.style.border     = '1px solid #86EFAC';
      el.style.color      = '#166534';
    } else {
      el.style.background = '#FEF2F2';
      el.style.border     = '1px solid #FCA5A5';
      el.style.color      = '#991B1B';
    }
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  function loadSettings() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    container.innerHTML = '<div style="padding:2rem; color:var(--color-text-muted);">Caricamento…</div>';

    getSettings()
      .then(renderSettings)
      .catch(function (err) {
        container.innerHTML = `<div class="empty-state" style="color:#c0392b;">
          <p>Errore caricamento impostazioni: ${sanitize(err.message)}</p>
          <button class="btn-admin btn-ghost btn-sm" onclick="location.reload()">Riprova</button>
        </div>`;
      });
  }

  // ============================================================
  // Navigazione alla sezione impostazioni
  // ============================================================
  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'settings') {
      loadSettings();
    }
  });

}());
