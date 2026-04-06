// admin-content.js — Gestione testi modificabili del sito
// Legge/scrive su localStorage['roccafiorita_content']
// Il sito pubblico (main.js) legge da questa chiave con fallback ai valori HTML

(function () {
  'use strict';

  const STORAGE_KEY = 'roccafiorita_content';

  const DEFAULT_ORARI = [
    { giorno: 'Lunedì',     orario: '06:00 – 13:30' },
    { giorno: 'Martedì',    orario: '06:00 – 13:30' },
    { giorno: 'Mercoledì',  orario: '06:00 – 13:30' },
    { giorno: 'Giovedì',    orario: '06:00 – 13:30' },
    { giorno: 'Venerdì',    orario: '06:00 – 13:30' },
    { giorno: 'Sabato',     orario: '06:00 – 13:30' },
    { giorno: 'Domenica',   orario: '06:00 – 12:00' },
  ];

  // ============================================================
  // Storage
  // ============================================================
  function getContent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : getDefaults();
    } catch (_) {
      return getDefaults();
    }
  }

  function getDefaults() {
    return {
      anno:       '',
      storia:     '',
      indirizzo:  '',
      telefono:   '',
      email:      'info@panificioroccafiorita.it',
      mapsLink:   '',
      orari:      DEFAULT_ORARI,
    };
  }

  function saveContent(content) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ============================================================
  // Render sezione contenuti
  // ============================================================
  function renderContentSection() {
    const container = document.getElementById('content-content');
    if (!container) return;
    container.style.display = '';

    const c = getContent();

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
        <h2 style="font-family:var(--font-display); font-size:1.2rem; color:var(--color-espresso);">
          Testi del sito
        </h2>
      </div>

      <div class="info-banner">
        <strong>Come funziona:</strong> le modifiche salvate qui vengono lette dal sito al prossimo caricamento.
        I campi lasciati vuoti mantengono i valori predefiniti scritti nell'HTML.
      </div>

      <form id="content-form" novalidate>

        <!-- Informazioni generali -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Informazioni generali</span>
          </div>
          <div class="panel-body">
            <div class="form-row">
              <div class="form-group">
                <label for="c-anno">Anno di fondazione</label>
                <input type="text" id="c-anno" value="${sanitize(c.anno)}" placeholder="es. 1978" />
              </div>
              <div class="form-group">
                <label for="c-telefono">Telefono</label>
                <input type="tel" id="c-telefono" value="${sanitize(c.telefono)}" placeholder="+39 000 0000000" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="c-indirizzo">Indirizzo completo</label>
                <input type="text" id="c-indirizzo" value="${sanitize(c.indirizzo)}" placeholder="Via Roma 1, Noto (SR)" />
              </div>
              <div class="form-group">
                <label for="c-email">Email di contatto</label>
                <input type="email" id="c-email" value="${sanitize(c.email)}" placeholder="info@panificioroccafiorita.it" />
              </div>
            </div>
            <div class="form-group">
              <label for="c-maps">Link Google Maps (embed URL)</label>
              <input type="text" id="c-maps" value="${sanitize(c.mapsLink)}" placeholder="https://www.google.com/maps/embed?pb=..." />
            </div>
          </div>
        </div>

        <!-- La nostra storia -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">La Nostra Storia</span>
          </div>
          <div class="panel-body">
            <div class="form-group">
              <label for="c-storia">Testo sezione Storia</label>
              <textarea id="c-storia" rows="6" placeholder="Racconta la storia del panificio...">${sanitize(c.storia)}</textarea>
              <span style="font-size:0.775rem; color:var(--color-text-muted);">Lascia vuoto per usare il testo predefinito nell'HTML.</span>
            </div>
          </div>
        </div>

        <!-- Orari di apertura -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Orari di apertura</span>
          </div>
          <div class="panel-body">
            <table class="orari-table" id="orari-table">
              ${(c.orari || DEFAULT_ORARI).map((row, idx) => `
                <tr>
                  <td>${sanitize(row.giorno)}</td>
                  <td><input type="text" data-day="${idx}" value="${sanitize(row.orario)}" placeholder="06:00 – 13:00 oppure Chiuso" /></td>
                </tr>`).join('')}
            </table>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
          <button type="submit" class="btn-admin btn-primary">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Salva modifiche
          </button>
        </div>

        <div class="form-success" id="content-save-msg" role="alert" style="display:none; margin-top:1rem; background:#E6F4EE; border:1px solid #2D7A47; color:#2D7A47; padding:0.75rem 1rem; border-radius:6px; font-size:0.875rem;">
          Modifiche salvate. Il sito le mostrerà al prossimo caricamento.
        </div>

      </form>`;

    // Submit
    document.getElementById('content-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveFormContent();
    });
  }

  // ============================================================
  // Salva dati form
  // ============================================================
  function saveFormContent() {
    const orariInputs = document.querySelectorAll('#orari-table input[data-day]');
    const orari = DEFAULT_ORARI.map((row, idx) => {
      const input = orariInputs[idx];
      return {
        giorno: row.giorno,
        orario: input ? input.value.trim() : row.orario,
      };
    });

    const content = {
      anno:      document.getElementById('c-anno').value.trim(),
      telefono:  document.getElementById('c-telefono').value.trim(),
      indirizzo: document.getElementById('c-indirizzo').value.trim(),
      email:     document.getElementById('c-email').value.trim(),
      mapsLink:  document.getElementById('c-maps').value.trim(),
      storia:    document.getElementById('c-storia').value.trim(),
      orari:     orari,
    };

    saveContent(content);

    const msg = document.getElementById('content-save-msg');
    if (msg) {
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
    }
  }

  // ============================================================
  // Punto di ingresso
  // ============================================================
  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'content') {
      renderContentSection();
    }
  });

  document.addEventListener('admin:ready', function () {
    // Pre-carica la sezione se visibile
    const section = document.getElementById('section-content');
    if (section && section.style.display !== 'none') {
      renderContentSection();
    }
  });

}());
