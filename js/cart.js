// cart.js — Gestione carrello con persistenza localStorage
// Espone window.Cart e dispatcha CustomEvent 'cart:updated' ad ogni modifica
// SICUREZZA: il carrello salva solo {id, kg} — i prezzi vengono sempre riletti da CONFIG

(function () {
  'use strict';

  const STORAGE_KEY = 'panificio_cart';

  // ============================================================
  // Helpers localStorage
  // ============================================================
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    dispatchUpdate();
  }

  function dispatchUpdate() {
    document.dispatchEvent(new CustomEvent('cart:updated', {
      detail: { items: loadItems() },
    }));
  }

  // Risolve i prodotti correnti (da localStorage admin se disponibili, altrimenti CONFIG)
  function getProductCatalog() {
    try {
      const stored = localStorage.getItem('roccafiorita_products');
      if (stored) {
        return JSON.parse(stored)
          .map(p => ({ ...p, minKg: Math.max(1, Math.round(p.minKg || 1)) }));
      }
    } catch (_) {}
    return CONFIG.products;
  }

  // ============================================================
  // API pubblica
  // ============================================================

  /**
   * Aggiunge o incrementa un prodotto nel carrello.
   * Salva solo {id, kg} — MAI il prezzo.
   */
  function add(productId, kg) {
    const catalog = getProductCatalog();
    const product = catalog.find(p => p.id === productId);
    if (!product) return;

    const qty = parseInt(kg, 10);
    if (isNaN(qty) || qty < product.minKg) return;

    const items = loadItems();
    const existing = items.find(i => i.id === productId);

    if (existing) {
      existing.kg = Math.round(existing.kg + qty);
    } else {
      items.push({
        id: productId,
        kg: qty,
      });
    }

    saveItems(items);
  }

  /**
   * Rimuove completamente un prodotto dal carrello.
   */
  function remove(productId) {
    const items = loadItems().filter(i => i.id !== productId);
    saveItems(items);
  }

  /**
   * Imposta la quantità (kg) di un prodotto. Se kg <= 0 rimuove.
   */
  function update(productId, kg) {
    const qty = parseFloat(kg);
    if (isNaN(qty) || qty <= 0) {
      remove(productId);
      return;
    }

    const catalog = getProductCatalog();
    const product = catalog.find(p => p.id === productId);
    const minKg = product ? product.minKg : 1;

    const items = loadItems();
    const item = items.find(i => i.id === productId);
    if (item) {
      item.kg = Math.round(Math.max(qty, minKg));
      saveItems(items);
    }
  }

  /**
   * Svuota il carrello.
   */
  function clear() {
    saveItems([]);
  }

  /**
   * Restituisce gli articoli arricchiti con nome e prezzo da CONFIG (fonte di verità).
   */
  function getItems() {
    const catalog = getProductCatalog();
    return loadItems().map(item => {
      const product = catalog.find(p => p.id === item.id);
      return {
        id: item.id,
        kg: item.kg,
        name: product ? product.name : item.id,
        pricePerKg: product ? product.pricePerKg : 0,
        unit: product ? (product.unit || 'cad.') : 'cad.',
      };
    });
  }

  /**
   * Calcola subtotale (senza spedizione) — prezzi sempre da CONFIG.
   */
  function getSubtotal() {
    return getItems().reduce((sum, i) => sum + i.pricePerKg * i.kg, 0);
  }

  /**
   * Calcola costo spedizione in base alla soglia CONFIG.
   */
  function getShipping() {
    const subtotal = getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal >= CONFIG.shipping.freeThreshold ? 0 : CONFIG.shipping.flatRate;
  }

  /**
   * Calcola totale finale (subtotale + spedizione).
   */
  function getTotal() {
    return getSubtotal() + getShipping();
  }

  /**
   * Numero di articoli nel carrello (per tipo prodotto).
   */
  function getCount() {
    return loadItems().length;
  }

  // ============================================================
  // Render sidebar
  // ============================================================

  function renderSidebar() {
    const items      = getItems();
    const itemsEl    = document.getElementById('cart-items');
    const footerEl   = document.getElementById('cart-footer');
    const shippingEl = document.getElementById('cart-shipping-note');
    const totalsEl   = document.getElementById('cart-totals');
    const badgeEl    = document.getElementById('cart-badge');

    if (!itemsEl) return;

    // Badge navbar
    if (badgeEl) {
      const count = getCount();
      badgeEl.textContent = count;
      badgeEl.classList.toggle('visible', count > 0);
    }

    if (items.length === 0) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <p>Il carrello è vuoto.</p>
          <p style="font-size:0.85rem; margin-top:0.5rem;">Aggiungi dei prodotti dalla sezione <a href="#prodotti" style="color:var(--color-gold)">Prodotti</a>.</p>
        </div>`;
      if (footerEl) footerEl.style.display = 'none';
      return;
    }

    if (footerEl) footerEl.style.display = '';

    // Articoli
    itemsEl.innerHTML = items.map(item => {
      const qty = Math.round(item.kg);
      const lineTotal = (item.pricePerKg * qty).toFixed(2);
      return `
        <div class="cart-item" data-id="${item.id}">
          <div>
            <div class="cart-item-name">${sanitize(item.name)}</div>
            <div class="cart-item-sub">€${item.pricePerKg.toFixed(2)} ${item.unit}</div>
          </div>
          <div class="cart-item-price">€${lineTotal}</div>
          <div class="cart-item-controls">
            <div class="cart-item-qty">
              <button class="cart-qty-minus" data-id="${item.id}" aria-label="Riduci quantità ${sanitize(item.name)}">−</button>
              <span>${qty}</span>
              <button class="cart-qty-plus" data-id="${item.id}" aria-label="Aumenta quantità ${sanitize(item.name)}">+</button>
            </div>
            <button class="cart-item-remove" data-id="${item.id}" aria-label="Rimuovi ${sanitize(item.name)} dal carrello">
              Rimuovi
            </button>
          </div>
        </div>`;
    }).join('');

    // Spedizione
    const subtotal  = getSubtotal();
    const shipping  = getShipping();
    const threshold = CONFIG.shipping.freeThreshold;
    if (shippingEl) {
      if (shipping === 0) {
        shippingEl.textContent = '✓ Spedizione gratuita inclusa';
        shippingEl.classList.add('free');
      } else {
        const remaining = (threshold - subtotal).toFixed(2);
        shippingEl.textContent = `Aggiungi €${remaining} per la spedizione gratuita`;
        shippingEl.classList.remove('free');
      }
    }

    // Totali
    if (totalsEl) {
      totalsEl.innerHTML = `
        <div class="cart-total-row">
          <span>Subtotale</span>
          <span>€${subtotal.toFixed(2)}</span>
        </div>
        <div class="cart-total-row">
          <span>Spedizione</span>
          <span>${shipping === 0 ? '<span style="color:var(--color-gold)">Gratuita</span>' : '€' + shipping.toFixed(2)}</span>
        </div>
        <div class="cart-total-row total">
          <span>Totale</span>
          <span class="cart-total-amount">€${getTotal().toFixed(2)}</span>
        </div>`;
    }

    // Event delegation per +/−/rimuovi nella sidebar
    itemsEl.querySelectorAll('.cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = getItems().find(i => i.id === id);
        const catalog = getProductCatalog();
        const product = catalog.find(p => p.id === id);
        const minKg = product ? product.minKg : 1;
        const current = Math.round(item ? item.kg : minKg);
        if (item && current - 1 >= minKg) update(id, current - 1);
      });
    });

    itemsEl.querySelectorAll('.cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = getItems().find(i => i.id === id);
        const catalog = getProductCatalog();
        const product = catalog.find(p => p.id === id);
        const step = product ? product.minKg : 1;
        if (item) update(id, item.kg + step);
      });
    });

    itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => remove(btn.dataset.id));
    });
  }

  // Sanitizzazione XSS per contenuto dinamico
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // Aggiorna la sidebar ad ogni modifica carrello
  document.addEventListener('cart:updated', renderSidebar);

  // Render iniziale (dal localStorage esistente)
  document.addEventListener('DOMContentLoaded', renderSidebar);

  // ============================================================
  // Esposizione pubblica
  // ============================================================
  window.Cart = { add, remove, update, clear, getItems, getSubtotal, getShipping, getTotal, getCount };

}());
