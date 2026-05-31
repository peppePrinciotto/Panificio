// admin-orders.js — Gestione ordini nel pannello admin
// Legge/scrive su Supabase via /.netlify/functions/admin-data
// Polling ogni 30 secondi, badge sidebar con ordini da spedire

(function () {
  'use strict';

  const API            = '/.netlify/functions/admin-data';
  let activeFilter     = 'all';
  let pollingTimer     = null;
  let knownOrderIds    = new Set();
  let isFirstLoad      = true;

  // ============================================================
  // Helper API
  // ============================================================
  function authHeaders() {
    const token = sessionStorage.getItem('admin_token') || '';
    console.log('[orders] Token inviato:', token ? 'presente' : 'NULLO',
      '| Primi 8:', token ? token.substring(0, 8) : 'N/A');
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
    };
  }

  function apiFetch(method, params, body) {
    const url  = API + '?' + new URLSearchParams(params).toString();
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Errore API (' + res.status + ')');
        return data;
      });
    });
  }

  function fetchOrders(status) {
    const params = { action: 'orders' };
    if (status && status !== 'all') params.status = status;
    return apiFetch('GET', params);
  }

  function markShipped(orderId) {
    return apiFetch('PUT', { action: 'order-status', id: orderId }, { status: 'shipped' });
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ============================================================
  // Badge sidebar: contatore ordini da spedire
  // ============================================================
  function updateBadge(orders) {
    const badge = document.getElementById('orders-badge');
    if (!badge) return;
    const count = orders.filter(o => o.status === 'paid').length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // ============================================================
  // Render sezione ordini
  // ============================================================
  function renderOrders(orders) {
    const container = document.getElementById('orders-content');
    if (!container) return;

    updateBadge(orders);

    const allCount     = orders.length;
    const pendingCount = orders.filter(o => o.status === 'paid').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;

    const filtered = applyFilter(orders, activeFilter);

    const filters = [
      { id: 'all',      label: `Tutti (${allCount})` },
      { id: 'paid',     label: `Da spedire (${pendingCount})` },
      { id: 'shipped',  label: `Spediti (${shippedCount})` },
    ];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
        <h2 style="font-family:var(--font-display); font-size:1.2rem; color:var(--color-espresso);">
          Ordini
        </h2>
        <span style="font-size:0.8rem; color:var(--color-text-muted);" id="orders-last-update">
          Aggiornato adesso
        </span>
      </div>

      <div class="filters-bar" id="orders-filters">
        ${filters.map(f => `
          <button class="filter-btn ${activeFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
            ${sanitize(f.label)}
          </button>`).join('')}
      </div>

      <div id="orders-list">
        ${filtered.length === 0 ? renderEmpty() : filtered.map(o => renderOrderCard(o)).join('')}
      </div>`;

    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        activeFilter = this.dataset.filter;
        renderOrders(orders);
      });
    });

    container.querySelectorAll('.btn-ship').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.dataset.id;
        if (!confirm('Segna questo ordine come spedito?')) return;
        this.disabled    = true;
        this.textContent = 'Aggiornamento…';
        markShipped(id)
          .then(() => loadOrders())
          .catch(err => {
            alert('Errore: ' + err.message);
            this.disabled    = false;
            this.textContent = 'Segna come spedito';
          });
      });
    });
  }

  // ============================================================
  // Filtri
  // ============================================================
  function applyFilter(orders, filter) {
    switch (filter) {
      case 'paid':    return orders.filter(o => o.status === 'paid');
      case 'shipped': return orders.filter(o => o.status === 'shipped');
      default:        return orders;
    }
  }

  // ============================================================
  // Card singolo ordine
  // ============================================================
  function renderOrderCard(o) {
    const isNew = !isFirstLoad && !knownOrderIds.has(o.id);

    const date = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

    const shippedDate = o.shippedAt
      ? new Date(o.shippedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;

    const statusBadge = o.status === 'shipped'
      ? `<span class="badge badge-success">Spedito${shippedDate ? ' ' + shippedDate : ''}</span>`
      : `<span class="badge badge-warning">Da spedire</span>`;

    const customer   = o.customer || {};
    const items      = Array.isArray(o.items) ? o.items : [];
    const itemsHtml  = items.length > 0
      ? items.map(i => `
          <div class="order-item-row">
            <span class="order-item-name">${sanitize(i.productName || i.name || '?')}</span>
            <span class="order-item-qty">${i.qty || i.kg || 1} cad.</span>
            <span class="order-item-price">€${((i.subtotal || (i.pricePerKg || 0) * (i.qty || i.kg || 1)) || 0).toFixed(2)}</span>
          </div>`).join('')
      : '<em style="color:var(--color-text-muted); font-size:0.85rem;">Nessun articolo</em>';

    const shipBtn = o.status !== 'shipped'
      ? `<button class="btn-admin btn-success btn-sm btn-ship" data-id="${sanitize(o.id)}">
           <svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;">
             <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
             <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
           </svg>
           Segna come spedito
         </button>`
      : '';

    return `
      <div class="reservation-card${isNew ? ' order-card--new' : ''}">
        <div class="reservation-top" style="flex-wrap:wrap; gap:0.5rem;">
          <div class="reservation-date">
            <strong>${sanitize(customer.name || '—')}</strong>
          </div>
          <div style="font-size:0.82rem; color:var(--color-text-muted);">
            ${sanitize(customer.email || '')}
            ${customer.city ? ' · ' + sanitize(customer.city) : ''}
          </div>
          ${statusBadge}
          <div style="margin-left:auto; font-size:0.8rem; color:var(--color-text-muted);">${date}</div>
        </div>

        <div class="order-items" style="margin:0.75rem 0; padding:0.75rem; background:var(--color-surface); border-radius:6px;">
          ${itemsHtml}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div class="order-totals" style="font-size:0.9rem;">
            <span>Spedizione: <strong>€${(o.shipping || 0).toFixed(2)}</strong></span>
            &nbsp;·&nbsp;
            <span>Totale: <strong style="color:var(--color-espresso);">€${(o.total || 0).toFixed(2)}</strong></span>
            ${o.paymentMethod ? `&nbsp;·&nbsp;<span style="color:var(--color-text-muted);">${sanitize(o.paymentMethod)}</span>` : ''}
          </div>
          <div style="display:flex; gap:0.5rem;">
            ${shipBtn}
          </div>
        </div>

        <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:0.5rem;">
          ID: ${sanitize(o.id || '—')}
        </div>
      </div>`;
  }

  function renderEmpty() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        <p>Nessun ordine in questa categoria.</p>
      </div>`;
  }

  // ============================================================
  // Carica ordini (usato anche dal polling)
  // ============================================================
  function loadOrders() {
    return fetchOrders()
      .then(function (orders) {
        // Identifica nuovi ordini per evidenziarli
        const newIds = new Set(orders.map(o => o.id));
        if (!isFirstLoad) {
          orders.forEach(o => {
            if (!knownOrderIds.has(o.id)) {
              // Nuovo ordine rilevato
            }
          });
        }
        knownOrderIds = newIds;
        isFirstLoad   = false;

        // Aggiorna timestamp
        const ts = document.getElementById('orders-last-update');
        if (ts) {
          ts.textContent = 'Aggiornato alle ' +
            new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        }

        renderOrders(orders);

        // Aggiorna badge anche quando si è su altra sezione
        updateBadge(orders);
      })
      .catch(function (err) {
        const container = document.getElementById('orders-content');
        if (container && container.children.length === 0) {
          container.innerHTML = `<div class="empty-state" style="color:#c0392b;">
            <p>Errore caricamento ordini: ${sanitize(err.message)}</p>
            <button class="btn-admin btn-ghost btn-sm" onclick="location.reload()">Riprova</button>
          </div>`;
        }
      });
  }

  // ============================================================
  // Polling ogni 30 secondi
  // ============================================================
  function startPolling() {
    stopPolling();
    pollingTimer = setInterval(function () {
      fetchOrders()
        .then(function (orders) {
          const hadNew = orders.some(o => !knownOrderIds.has(o.id));
          const newIds = new Set(orders.map(o => o.id));
          knownOrderIds = newIds;

          updateBadge(orders);

          // Se la sezione ordini è visibile, ri-renderizza (con highlight se nuovi)
          const section = document.getElementById('section-orders');
          if (section && section.style.display !== 'none') {
            if (hadNew) isFirstLoad = false;
            renderOrders(orders);

            const ts = document.getElementById('orders-last-update');
            if (ts) {
              ts.textContent = 'Aggiornato alle ' +
                new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            }
          }
        })
        .catch(() => {});
    }, 30000);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  // ============================================================
  // Caricamento iniziale (badge) all'avvio admin
  // ============================================================
  document.addEventListener('admin:ready', function () {
    fetchOrders()
      .then(updateBadge)
      .catch(() => {});
    startPolling();
  });

  // ============================================================
  // Navigazione alla sezione ordini
  // ============================================================
  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'orders') {
      const container = document.getElementById('orders-content');
      if (container && container.innerHTML === '') {
        container.innerHTML = '<div class="loading-state" style="padding:2rem; text-align:center; color:var(--color-text-muted);">Caricamento ordini…</div>';
      }
      isFirstLoad = true;
      loadOrders();
    }
  });

}());
