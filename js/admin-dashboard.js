// admin-dashboard.js — Dashboard vendite con grafico Canvas nativo ed esportazione CSV
// Legge ordini da Supabase via /.netlify/functions/admin-data

(function () {
  'use strict';

  const API = '/.netlify/functions/admin-data';

  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-based

  // ============================================================
  // Fetch ordini da Supabase
  // ============================================================
  function authHeaders() {
    const token = sessionStorage.getItem('admin_token') || '';
    console.log('[dashboard] Token inviato:', token ? 'presente' : 'NULLO',
      '| Primi 8:', token ? token.substring(0, 8) : 'N/A');
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
    };
  }

  function fetchAllOrders() {
    const url = API + '?' + new URLSearchParams({ action: 'orders' }).toString();
    return fetch(url, { headers: authHeaders() })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Errore API');
          return data;
        });
      });
  }

  // ============================================================
  // Helpers dati
  // ============================================================
  function ordersForMonth(orders, year, month) {
    return orders.filter(o => {
      const d = new Date(o.date || o.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  function calcStats(orders) {
    const incasso = orders.reduce((s, o) => s + (o.total || 0), 0);
    const kg = orders.reduce((s, o) => {
      return s + (o.items || []).reduce((si, i) => si + (i.qty || i.kg || 0), 0);
    }, 0);
    return { incasso, ordini: orders.length, kg };
  }

  function prevMonth(year, month) {
    if (month === 0) return { year: year - 1, month: 11 };
    return { year, month: month - 1 };
  }

  function nextMonthObj(year, month) {
    if (month === 11) return { year: year + 1, month: 0 };
    return { year, month: month + 1 };
  }

  function monthLabel(year, month) {
    return new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================================
  // Render Dashboard
  // ============================================================
  function renderDashboard(allOrders) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const ordersMonth  = ordersForMonth(allOrders, currentYear, currentMonth);
    const prev         = calcStats(ordersForMonth(allOrders, ...Object.values(prevMonth(currentYear, currentMonth))));
    const current      = calcStats(ordersMonth);
    const byProduct    = aggregateByProduct(ordersMonth);

    const deltaIncasso = prev.incasso > 0 ? ((current.incasso - prev.incasso) / prev.incasso * 100).toFixed(0) : null;
    const deltaKg      = prev.kg > 0 ? ((current.kg - prev.kg) / prev.kg * 100).toFixed(0) : null;

    const trendIncasso = deltaIncasso !== null
      ? `<span class="stat-trend ${parseFloat(deltaIncasso) >= 0 ? 'up' : 'down'}">${deltaIncasso >= 0 ? '+' : ''}${deltaIncasso}% vs mese prec.</span>`
      : '<span class="stat-trend">— nessun dato prec.</span>';

    const trendOrdini = prev.ordini > 0
      ? `<span class="stat-trend ${current.ordini >= prev.ordini ? 'up' : 'down'}">${current.ordini >= prev.ordini ? '+' : ''}${current.ordini - prev.ordini} vs mese prec.</span>`
      : '<span class="stat-trend">—</span>';

    const trendKg = deltaKg !== null
      ? `<span class="stat-trend ${parseFloat(deltaKg) >= 0 ? 'up' : 'down'}">${deltaKg >= 0 ? '+' : ''}${deltaKg}% vs mese prec.</span>`
      : '<span class="stat-trend">—</span>';

    container.innerHTML = `
      <!-- Navigazione mese -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
        <h2 style="font-family:var(--font-display); font-size:1.2rem; color:var(--color-espresso);">
          Riepilogo — ${capitalize(monthLabel(currentYear, currentMonth))}
        </h2>
        <div class="month-nav">
          <button class="month-nav-btn" id="prev-month-btn">&#8592; Prec.</button>
          <span class="month-label">${capitalize(monthLabel(currentYear, currentMonth))}</span>
          <button class="month-nav-btn" id="next-month-btn">Succ. &#8594;</button>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Incasso</div>
          <div class="stat-value">€${current.incasso.toFixed(2)}</div>
          ${trendIncasso}
        </div>
        <div class="stat-card">
          <div class="stat-label">Ordini</div>
          <div class="stat-value">${current.ordini}</div>
          ${trendOrdini}
        </div>
        <div class="stat-card">
          <div class="stat-label">Unità vendute</div>
          <div class="stat-value">${current.kg.toFixed(0)}</div>
          ${trendKg}
        </div>
      </div>

      <!-- Tabella per prodotto -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Vendite per prodotto — ${capitalize(monthLabel(currentYear, currentMonth))}</span>
          <button class="btn-admin btn-ghost btn-sm" id="export-csv-btn">Esporta CSV</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Unità vendute</th>
                <th>Incasso</th>
                <th>Ordini</th>
              </tr>
            </thead>
            <tbody>
              ${renderProductRows(byProduct)}
              ${renderTotalsRow(ordersMonth)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Grafico ultimi 6 mesi -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Incasso — Ultimi 6 mesi</span>
        </div>
        <div class="panel-body">
          <div class="chart-container">
            <canvas id="sales-chart" role="img" aria-label="Grafico incasso ultimi 6 mesi"></canvas>
          </div>
        </div>
      </div>

      <!-- Ultimi ordini -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Ultimi ordini</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Prodotti</th>
                <th>Totale</th>
                <th>Metodo</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${renderRecentOrders(ordersMonth)}
            </tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('prev-month-btn').addEventListener('click', () => {
      const p = prevMonth(currentYear, currentMonth);
      currentYear  = p.year;
      currentMonth = p.month;
      renderDashboard(allOrders);
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
      const n = nextMonthObj(currentYear, currentMonth);
      currentYear  = n.year;
      currentMonth = n.month;
      renderDashboard(allOrders);
    });

    document.getElementById('export-csv-btn').addEventListener('click', () => {
      exportCsv(ordersMonth, currentYear, currentMonth);
    });

    requestAnimationFrame(() => drawChart(allOrders));
  }

  function aggregateByProduct(orders) {
    const map = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.productId || item.productName || '?';
        if (!map[key]) map[key] = { name: item.productName || key, kg: 0, incasso: 0, ordini: 0 };
        map[key].kg      += item.qty || item.kg || 0;
        map[key].incasso += item.subtotal || ((item.pricePerKg || 0) * (item.qty || item.kg || 0)) || 0;
        map[key].ordini  += 1;
      });
    });
    return map;
  }

  function renderProductRows(byProduct) {
    if (Object.keys(byProduct).length === 0) {
      return `<tr><td colspan="4" style="color:var(--color-text-muted); font-style:italic;">Nessun ordine questo mese</td></tr>`;
    }
    return Object.values(byProduct).map(p => `
      <tr>
        <td>${sanitize(p.name)}</td>
        <td>${p.kg.toFixed(0)} cad.</td>
        <td>€${p.incasso.toFixed(2)}</td>
        <td>${p.ordini}</td>
      </tr>`).join('');
  }

  function renderTotalsRow(orders) {
    const stats = calcStats(orders);
    return `
      <tr class="total-row">
        <td><strong>TOTALE</strong></td>
        <td>${stats.kg.toFixed(0)} cad.</td>
        <td>€${stats.incasso.toFixed(2)}</td>
        <td>${stats.ordini}</td>
      </tr>`;
  }

  function renderRecentOrders(orders) {
    const recent = [...orders].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 10);
    if (recent.length === 0) {
      return `<tr><td colspan="6" style="color:var(--color-text-muted); font-style:italic;">Nessun ordine</td></tr>`;
    }
    return recent.map(o => {
      const items = (o.items || []).map(i => `${i.qty || i.kg || 1} ${sanitize(i.productName || i.name || '?')}`).join(', ');
      const date  = new Date(o.date || o.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `
        <tr>
          <td style="font-size:0.8rem; color:var(--color-text-muted);">${sanitize(o.id || '—')}</td>
          <td>${sanitize(o.customer?.name || '—')}</td>
          <td style="font-size:0.8rem;">${items}</td>
          <td>€${(o.total || 0).toFixed(2)}</td>
          <td>${sanitize(o.paymentMethod || '—')}</td>
          <td style="font-size:0.8rem; color:var(--color-text-muted);">${date}</td>
        </tr>`;
    }).join('');
  }

  // ============================================================
  // Grafico Canvas nativo — barre verticali (ultimi 6 mesi)
  // ============================================================
  function drawChart(allOrders) {
    const canvas = document.getElementById('sales-chart');
    if (!canvas) return;

    const ctx    = canvas.getContext('2d');
    const months = [];

    let y = currentYear, m = currentMonth;
    for (let i = 0; i < 6; i++) {
      const stats = calcStats(ordersForMonth(allOrders, y, m));
      months.unshift({ label: new Date(y, m, 1).toLocaleDateString('it-IT', { month: 'short' }), value: stats.incasso });
      const p = prevMonth(y, m);
      y = p.year; m = p.month;
    }

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.parentElement.clientWidth || 600;
    const H   = 180;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const padLeft   = 55, padRight = 16, padTop = 16, padBottom = 32;
    const plotW     = W - padLeft - padRight;
    const plotH     = H - padTop  - padBottom;
    const maxVal    = Math.max(...months.map(m => m.value), 1);
    const barW      = Math.floor(plotW / months.length * 0.5);
    const gap       = (plotW - barW * months.length) / (months.length + 1);
    const gold      = '#A07830';
    const muted     = '#C4A882';

    ctx.clearRect(0, 0, W, H);

    const lines = 4;
    ctx.strokeStyle = '#E8DCC8';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= lines; i++) {
      const lineY = padTop + (plotH / lines) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, lineY);
      ctx.lineTo(padLeft + plotW, lineY);
      ctx.stroke();
      const val = maxVal - (maxVal / lines) * i;
      ctx.fillStyle = '#7A6550';
      ctx.font      = '11px Lora, Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('€' + Math.round(val), padLeft - 6, lineY + 4);
    }

    months.forEach((mon, idx) => {
      const x    = padLeft + gap + idx * (barW + gap);
      const barH = (mon.value / maxVal) * plotH;
      const barY = padTop + plotH - barH;

      ctx.fillStyle = (idx === months.length - 1) ? gold : muted;
      ctx.fillRect(x, barY, barW, barH);

      ctx.fillStyle = '#7A6550';
      ctx.font      = '11px Lora, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(mon.label, x + barW / 2, H - padBottom + 16);

      if (mon.value > 0) {
        ctx.fillStyle = '#3D2314';
        ctx.font      = '10px Lora, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('€' + mon.value.toFixed(0), x + barW / 2, barY - 4);
      }
    });

    canvas.onmousemove = function (e) {
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      let hovered = -1;
      months.forEach((mon, idx) => {
        const x = padLeft + gap + idx * (barW + gap);
        if (mx >= x && mx <= x + barW) hovered = idx;
      });
      canvas.title = hovered >= 0 ? `${months[hovered].label}: €${months[hovered].value.toFixed(2)}` : '';
    };
  }

  // ============================================================
  // Esportazione CSV
  // ============================================================
  function exportCsv(orders, year, month) {
    if (orders.length === 0) {
      alert('Nessun ordine da esportare per questo mese.');
      return;
    }
    const rows = [['ID Ordine', 'Data', 'Cliente', 'Email', 'Città', 'Prodotti', 'Spedizione', 'Totale', 'Pagamento']];
    orders.forEach(o => {
      const items = (o.items || []).map(i => `${i.qty || i.kg || 1} ${i.productName || i.name || '?'}`).join(' | ');
      rows.push([
        o.id || '',
        new Date(o.date || o.createdAt).toLocaleDateString('it-IT'),
        o.customer?.name  || '',
        o.customer?.email || '',
        o.customer?.city  || '',
        items,
        o.shipping === 0 ? 'Gratuita' : '€' + (o.shipping || 0).toFixed(2),
        '€' + (o.total || 0).toFixed(2),
        o.paymentMethod || '',
      ]);
    });
    const csv  = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `ordini-${year}-${String(month + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Utility
  // ============================================================
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ============================================================
  // Caricamento dashboard
  // ============================================================
  function loadDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    container.innerHTML = '<div class="loading-state" style="padding:2rem; text-align:center; color:var(--color-text-muted);">Caricamento dati…</div>';

    fetchAllOrders()
      .then(function (orders) {
        renderDashboard(orders);
      })
      .catch(function (err) {
        container.innerHTML = `<div class="empty-state" style="color:#c0392b;">
          <p>Errore caricamento dati: ${sanitize(err.message)}</p>
          <button class="btn-admin btn-ghost btn-sm" onclick="location.reload()">Riprova</button>
        </div>`;
      });
  }

  // ============================================================
  // Punto di ingresso
  // ============================================================
  document.addEventListener('admin:ready', function () {
    loadDashboard();
  });

  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'dashboard') {
      loadDashboard();
    }
  });

}());
