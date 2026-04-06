// admin-reservations.js — Gestione prenotazioni nel pannello admin
// Legge/scrive su localStorage['roccafiorita_reservations']
// NOTA: le prenotazioni sono visibili solo dal browser che ha ricevuto il form

(function () {
  'use strict';

  const STORAGE_KEY = 'roccafiorita_reservations';
  let activeFilter  = 'all';

  // ============================================================
  // Storage
  // ============================================================
  function getReservations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveReservations(reservations) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ============================================================
  // Filtri
  // ============================================================
  function applyFilter(reservations, filter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    switch (filter) {
      case 'today':
        return reservations.filter(r => {
          const d = new Date(r.data);
          return d >= today && d < new Date(today.getTime() + 86400000);
        });
      case 'week':
        return reservations.filter(r => {
          const d = new Date(r.data);
          return d >= today && d < endOfWeek;
        });
      case 'pending':
        return reservations.filter(r => r.status === 'pending');
      case 'confirmed':
        return reservations.filter(r => r.status === 'confirmed');
      default:
        return reservations;
    }
  }

  // ============================================================
  // Render
  // ============================================================
  function renderReservations() {
    const container = document.getElementById('reservations-content');
    if (!container) return;

    const all      = getReservations();
    const filtered = applyFilter(all, activeFilter)
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    const filters = [
      { id: 'all',       label: `Tutte (${all.length})` },
      { id: 'today',     label: 'Oggi' },
      { id: 'week',      label: 'Questa settimana' },
      { id: 'pending',   label: `In attesa (${all.filter(r => r.status === 'pending').length})` },
      { id: 'confirmed', label: `Confermate (${all.filter(r => r.status === 'confirmed').length})` },
    ];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
        <h2 style="font-family:var(--font-display); font-size:1.2rem; color:var(--color-espresso);">
          Prenotazioni
        </h2>
      </div>

      <div class="info-banner">
        <strong>Nota:</strong> le prenotazioni sono visibili solo dal browser/dispositivo che ha gestito il sito.
        Per un sistema multi-dispositivo serve un backend. Le prenotazioni inviate via form vengono
        inviate anche a <strong>Formspree</strong> (se configurato) come copia di sicurezza.
      </div>

      <div class="filters-bar" id="reservations-filters">
        ${filters.map(f => `
          <button class="filter-btn ${activeFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
            ${sanitize(f.label)}
          </button>`).join('')}
      </div>

      <div id="reservations-list">
        ${filtered.length === 0 ? renderEmpty() : filtered.map(renderReservationCard).join('')}
      </div>`;

    // Filtri
    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        activeFilter = this.dataset.filter;
        renderReservations();
      });
    });

    // Azioni su prenotazione
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id     = this.dataset.id;
        const action = this.dataset.action;
        handleReservationAction(id, action);
      });
    });
  }

  function renderReservationCard(r) {
    const statusBadge = {
      pending:   '<span class="badge badge-warning">In attesa</span>',
      confirmed: '<span class="badge badge-success">Confermata</span>',
      rejected:  '<span class="badge badge-danger">Rifiutata</span>',
    }[r.status] || '<span class="badge badge-muted">—</span>';

    const dateFormatted = r.data
      ? new Date(r.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

    const createdAt = r.createdAt
      ? new Date(r.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';

    const confirmBtn = r.status !== 'confirmed'
      ? `<button class="btn-admin btn-success btn-sm" data-action="confirm" data-id="${sanitize(r.id)}">Conferma</button>`
      : '';
    const rejectBtn  = r.status !== 'rejected'
      ? `<button class="btn-admin btn-ghost btn-sm" data-action="reject" data-id="${sanitize(r.id)}">Rifiuta</button>`
      : '';

    return `
      <div class="reservation-card">
        <div class="reservation-top">
          <div class="reservation-date">Ritiro: ${dateFormatted}</div>
          <div class="reservation-name">${sanitize(r.nome || '—')}</div>
          <div class="reservation-product">${sanitize(r.prodotto || '—')}</div>
          ${statusBadge}
          <div style="margin-left:auto; display:flex; align-items:center; gap:0.5rem;">
            ${r.telefono ? `<a href="tel:${sanitize(r.telefono)}" class="btn-admin btn-ghost btn-sm" title="Chiama">
              <svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.08 1.18 2 2 0 012.07 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              ${sanitize(r.telefono)}
            </a>` : ''}
          </div>
        </div>
        ${r.note ? `<div class="reservation-note">Note: ${sanitize(r.note)}</div>` : ''}
        <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:0.5rem;">
          Ricevuta: ${createdAt}
        </div>
        <div class="reservation-actions">
          ${confirmBtn}
          ${rejectBtn}
          <button class="btn-admin btn-danger btn-sm" data-action="delete" data-id="${sanitize(r.id)}">Elimina</button>
        </div>
      </div>`;
  }

  function renderEmpty() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>Nessuna prenotazione in questa categoria.</p>
      </div>`;
  }

  // ============================================================
  // Azioni
  // ============================================================
  function handleReservationAction(id, action) {
    const reservations = getReservations();
    const idx = reservations.findIndex(r => r.id === id);
    if (idx < 0) return;

    switch (action) {
      case 'confirm':
        reservations[idx].status = 'confirmed';
        saveReservations(reservations);
        break;
      case 'reject':
        reservations[idx].status = 'rejected';
        saveReservations(reservations);
        break;
      case 'delete':
        if (confirm('Eliminare questa prenotazione?')) {
          reservations.splice(idx, 1);
          saveReservations(reservations);
        }
        break;
    }

    renderReservations();
  }

  // ============================================================
  // Punto di ingresso
  // ============================================================
  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'reservations') {
      renderReservations();
    }
  });

}());
