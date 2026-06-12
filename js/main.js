// main.js — UI orchestration: navbar, animazioni, carrello UI, modal, form
// Dipende da: config.js, cart.js, checkout.js

(function () {
  'use strict';

  // ============================================================
  // DOMContentLoaded — punto di ingresso
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    initCopyrightYear();
    initNavbar();
    initHamburger();
    initShippingSettings(); // aggiorna CONFIG.shipping da Supabase prima del carrello
    initProductCards();
    initCartSidebar();
    initCheckoutModal();
    initScrollAnimations();
    initPrenotaForm();
    initLegalModals();
    initDateMin();
    initCookieBanner();
    initContentFromSupabase();
    initCartSwipeClose();
  });

  // ============================================================
  // Sanitizzazione XSS (prevenzione DOM injection)
  // ============================================================
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ============================================================
  // Impostazioni spedizione — legge da Supabase e aggiorna CONFIG
  // ============================================================
  function initShippingSettings() {
    fetch('/.netlify/functions/get-settings')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (typeof data.freeThreshold === 'number') CONFIG.shipping.freeThreshold = data.freeThreshold;
        if (typeof data.flatRate      === 'number') CONFIG.shipping.flatRate      = data.flatRate;
        // Ri-renderizza il carrello con i valori aggiornati
        document.dispatchEvent(new CustomEvent('cart:updated'));
      })
      .catch(function () { /* usa valori default da config.js */ });
  }

  // ============================================================
  // Anno copyright dinamico
  // ============================================================
  function initCopyrightYear() {
    const el = document.getElementById('copyright-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  // ============================================================
  // Navbar: trasparente → solida dopo 80px scroll
  // ============================================================
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    function onScroll() {
      navbar.classList.toggle('scrolled', window.scrollY > 80);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // stato iniziale
  }

  // ============================================================
  // Hamburger menu mobile
  // ============================================================
  function initHamburger() {
    const btn     = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('nav-overlay');
    if (!btn) return;

    function openNav() {
      document.body.classList.add('nav-open');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Chiudi menu');
    }

    function closeNav() {
      document.body.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Apri menu');
    }

    btn.addEventListener('click', function () {
      document.body.classList.contains('nav-open') ? closeNav() : openNav();
    });

    if (overlay) overlay.addEventListener('click', closeNav);

    // Chiudi nav mobile al click su un link
    document.querySelectorAll('.navbar-nav a').forEach(link => {
      link.addEventListener('click', closeNav);
    });

    // Chiudi con ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) closeNav();
    });
  }

  // ============================================================
  // Prodotti — legge da Supabase (anon key) con fallback a CONFIG
  // ============================================================
  function fetchProductsFromSupabase() {
    const url = CONFIG.supabase.url + '/rest/v1/products?select=*&available=eq.true&order=created_at.asc';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    return fetch(url, {
      headers: {
        'apikey':        CONFIG.supabase.anonKey,
        'Authorization': 'Bearer ' + CONFIG.supabase.anonKey,
      },
      signal: controller.signal,
    })
      .then(function (res) {
        clearTimeout(timeout);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        return rows.map(function (r) {
          return {
            id:          r.id,
            name:        r.name,
            description: r.description || '',
            price:       r.price,
            weightG:     r.weight_g,
            stock:       r.stock,
            available:   r.available !== false,
            imageUrl:    r.image_url || '',
          };
        });
      })
      .catch(function (err) {
        clearTimeout(timeout);
        console.warn('[Prodotti] Supabase non raggiungibile, uso fallback CONFIG:', err.message);
        return null;
      });
  }

  // ============================================================
  // Skeleton loader — tre card placeholder durante il caricamento
  // ============================================================
  function renderSkeletonCards(grid) {
    grid.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const sk = document.createElement('article');
      sk.className = 'product-card product-card--skeleton';
      sk.setAttribute('aria-hidden', 'true');
      sk.innerHTML = `
        <div class="skeleton-img"></div>
        <div class="product-body">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line skeleton-line--desc"></div>
          <div class="skeleton-line skeleton-line--desc"></div>
          <div class="skeleton-btn"></div>
        </div>`;
      grid.appendChild(sk);
    }
  }

  // ============================================================
  // Card prodotti — generate dai prodotti caricati da Supabase
  // ============================================================
  function initProductCards() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    renderSkeletonCards(grid);

    fetchProductsFromSupabase().then(function (supabaseProducts) {
      const products = supabaseProducts && supabaseProducts.length > 0
        ? supabaseProducts
        : CONFIG.products;

      grid.innerHTML = '';
      renderProductCards(grid, products);
    });
  }

  function renderProductCards(grid, products) {

    products.forEach(product => {
      const stock = (product.stock !== null && product.stock !== undefined)
        ? parseInt(product.stock, 10)
        : null;
      const outOfStock = stock !== null && stock === 0;

      const card = document.createElement('article');
      card.className = 'product-card fade-in' + (outOfStock ? ' product-card--esaurito' : '');
      card.setAttribute('aria-label', sanitize(product.name));

      const imgContent = product.imageUrl
        ? `<img src="${sanitize(product.imageUrl)}" alt="${sanitize(product.name)}" loading="lazy" />`
        : `<div class="product-img" style="background-color:#C4A882;"
                role="img" aria-label="${sanitize(product.name)}">${sanitize(product.name)}</div>`;

      const stockNote = outOfStock
        ? `<p class="stock-alert">Prodotto esaurito</p>`
        : '';

      card.innerHTML = `
        ${imgContent}
        <div class="product-body">
          <h3 class="product-name">${sanitize(product.name)}</h3>
          ${product.weightG ? `<span class="product-weight" style="font-variant-caps:normal;text-transform:none;">Confezione da ${sanitize(String(product.weightG))}g</span>` : ''}
          <p class="product-desc">${sanitize(product.description || '')}</p>

          <div class="qty-selector">
            <label for="qty-${sanitize(product.id)}">Quantità</label>
            <div class="qty-input-wrap">
              <button type="button" class="qty-dec" data-id="${sanitize(product.id)}"
                      aria-label="Riduci quantità" ${outOfStock ? 'disabled' : ''}>−</button>
              <input type="number" id="qty-${sanitize(product.id)}"
                     value="1" min="1" max="99" step="1"
                     aria-label="Quantità di ${sanitize(product.name)}"
                     ${outOfStock ? 'disabled' : ''} />
              <button type="button" class="qty-inc" data-id="${sanitize(product.id)}"
                      aria-label="Aumenta quantità" ${outOfStock ? 'disabled' : ''}>+</button>
            </div>
          </div>
          ${stockNote}

          <div class="product-footer">
            <div class="product-price-block">
              <span class="product-price-label">Prezzo / confezione</span>
              <span class="price">€${parseFloat(product.price).toFixed(2)}</span>
            </div>
            <button type="button" class="btn btn-primary btn-add-cart btn-sm"
                    data-id="${sanitize(product.id)}"
                    aria-label="Aggiungi ${sanitize(product.name)} al carrello"
                    ${outOfStock ? 'disabled' : ''}>
              ${outOfStock ? 'Esaurito' : 'Aggiungi'}
            </button>
          </div>
        </div>`;

      if (!outOfStock) {
        // Decrement
        card.querySelector('.qty-dec').addEventListener('click', function () {
          const input = card.querySelector(`#qty-${product.id}`);
          const val   = parseInt(input.value, 10) || 1;
          if (val - 1 >= 1) input.value = val - 1;
        });

        // Increment
        card.querySelector('.qty-inc').addEventListener('click', function () {
          const input = card.querySelector(`#qty-${product.id}`);
          const val   = parseInt(input.value, 10) || 1;
          const max   = stock !== null ? Math.min(stock, 99) : 99;
          if (val + 1 <= max) {
            input.value = val + 1;
          } else {
            showInlineStockMsg(card, stock !== null ? stock : 99);
          }
        });

        // Clamp su input manuale
        card.querySelector(`#qty-${product.id}`).addEventListener('change', function () {
          const val = parseInt(this.value, 10);
          const max = stock !== null ? Math.min(stock, 99) : 99;
          if (isNaN(val) || val < 1) { this.value = 1; return; }
          if (val > max) {
            this.value = max;
            showInlineStockMsg(card, stock !== null ? stock : 99);
          }
        });

        // Aggiungi al carrello
        card.querySelector('.btn-add-cart').addEventListener('click', function () {
          const btn   = this;
          const input = card.querySelector(`#qty-${product.id}`);
          const qty   = parseInt(input.value, 10);

          if (isNaN(qty) || qty < 1) return;

          if (stock !== null && qty > stock) {
            input.value = stock;
            showInlineStockMsg(card, stock);
            return;
          }

          Cart.add(product.id, qty);
          openCartSidebar();

          btn.classList.add('adding');
          setTimeout(() => btn.classList.remove('adding'), 500);
        });
      }

      grid.appendChild(card);
    });

    // Avvia animazioni scroll sulle nuove card
    initScrollAnimations();
  }

  function showInlineStockMsg(card, stock) {
    if (card.querySelector('.stock-inline-msg')) return;
    const msg = document.createElement('p');
    msg.className = 'stock-inline-msg';
    msg.textContent = `Disponibili solo ${stock} unità`;
    msg.style.cssText = `font-family:'Lora',Georgia,serif;font-size:0.82rem;color:#A07830;font-style:italic;margin-top:0.4rem;`;
    const footer = card.querySelector('.product-footer');
    if (footer) footer.insertAdjacentElement('afterend', msg);
    setTimeout(() => msg.remove(), 3000);
  }

  // ============================================================
  // Sidebar Carrello
  // ============================================================
  function initCartSidebar() {
    const toggleBtn   = document.getElementById('cart-toggle-btn');
    const closeBtn    = document.getElementById('cart-close-btn');
    const overlay     = document.getElementById('cart-overlay');
    const checkoutBtn = document.getElementById('checkout-open-btn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', openCartSidebar);
      // touchstart esplicito: elimina il 300ms delay iOS su dispositivi che ignorano touch-action
      toggleBtn.addEventListener('touchstart', function (e) {
        e.preventDefault(); // previene il click successivo (evita doppio fire)
        openCartSidebar();
      }, { passive: false });
    }
    if (closeBtn)  closeBtn.addEventListener('click', closeCartSidebar);
    if (overlay)   overlay.addEventListener('click', closeCartSidebar);

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function () {
        if (Cart.getCount() === 0) return;
        closeCartSidebar();
        openCheckoutModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('cart-open')) {
        closeCartSidebar();
      }
    });
  }

  // Swipe-to-close per carrello (bottom sheet mobile)
  function initCartSwipeClose() {
    const sidebar = document.getElementById('cart-sidebar');
    if (!sidebar) return;

    let startY = 0;
    sidebar.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchend', function (e) {
      const deltaY = e.changedTouches[0].clientY - startY;
      if (deltaY > 80) closeCartSidebar();
    }, { passive: true });
  }

  function openCartSidebar() {
    document.body.classList.add('cart-open');
    const btn = document.getElementById('cart-toggle-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar) sidebar.focus();
  }

  function closeCartSidebar() {
    document.body.classList.remove('cart-open');
    const btn = document.getElementById('cart-toggle-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  // ============================================================
  // Modal Checkout
  // ============================================================
  function initCheckoutModal() {
    const overlay  = document.getElementById('checkout-overlay');
    const closeBtn = document.getElementById('checkout-close-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeCheckoutModal);

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeCheckoutModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('modal-open')) {
        closeCheckoutModal();
      }
    });

    // Evento da checkout.js (bottone "Chiudi" dopo successo)
    document.addEventListener('checkout:close', closeCheckoutModal);
  }

  function openCheckoutModal() {
    document.body.classList.add('modal-open');
    document.dispatchEvent(new CustomEvent('checkout:opened'));
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.focus();
  }

  function closeCheckoutModal() {
    document.body.classList.remove('modal-open');
    // Resetta il form se era in stato successo
    if (typeof CheckoutResetForm === 'function') CheckoutResetForm();
  }

  // ============================================================
  // Scroll animations — IntersectionObserver
  // ============================================================
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  }

  // ============================================================
  // Form Prenotazione
  // ============================================================
  function initPrenotaForm() {
    const form = document.getElementById('prenota-form');
    if (!form) return;

    const fields = [
      { id: 'prenota-nome',     label: 'Nome e cognome',  required: true },
      { id: 'prenota-tel',      label: 'Telefono',        required: true, pattern: /^[\d\s\+\-\(\)]{7,20}$/ },
      { id: 'prenota-data',     label: 'Data di ritiro',  required: true },
      { id: 'prenota-prodotto', label: 'Prodotto',        required: true },
    ];

    // Validazione onblur campo per campo
    fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) el.addEventListener('blur', () => validateField(f));
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot check
      const honeypot = form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value) {
        showPrenotaSuccess(); // finge successo, non invia
        return;
      }

      // Rate limiting: 1 invio per minuto
      if (!canSubmitForm('prenota')) {
        const btn = form.querySelector('[type="submit"]');
        if (btn) btn.textContent = 'Attendi prima di rinviare';
        setTimeout(() => {
          if (btn) btn.textContent = btn.dataset.originalText || 'Invia prenotazione';
        }, 5000);
        return;
      }

      let allValid = true;
      fields.forEach(f => {
        if (!validateField(f)) allValid = false;
      });

      if (!allValid) return;

      const submitBtn = form.querySelector('[type="submit"]');
      setButtonLoading(submitBtn, true);

      // Salva prenotazione in localStorage per il pannello admin
      saveReservationToStorage(form);

      const endpoint = CONFIG.formspree.reservationEndpoint;

      if (!endpoint || endpoint.includes('YYYYYYYY')) {
        setTimeout(() => {
          showPrenotaSuccess();
          form.reset();
          setButtonLoading(submitBtn, false);
        }, 800);
        return;
      }

      const data = new FormData(form);

      fetch(endpoint, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' },
      })
        .then(function (res) {
          if (res.ok) {
            showPrenotaSuccess();
            form.reset();
          } else {
            return res.json().then(function (json) {
              throw new Error(json.error || 'Errore di invio');
            });
          }
        })
        .catch(function (err) {
          console.error('[Prenota] Errore:', err);
          const btn = form.querySelector('[type="submit"]');
          if (btn) btn.textContent = 'Errore — riprova';
        })
        .finally(function () {
          setButtonLoading(submitBtn, false);
        });
    });

    function validateField(f) {
      const el  = document.getElementById(f.id);
      const err = document.getElementById(f.id + '-err');
      if (!el) return true;

      el.classList.remove('invalid');
      if (err) err.textContent = '';

      const val = el.value.trim();

      if (f.required && !val) {
        el.classList.add('invalid');
        if (err) err.textContent = `${f.label} è obbligatorio`;
        return false;
      }

      if (f.pattern && val && !f.pattern.test(val)) {
        el.classList.add('invalid');
        if (err) err.textContent = `${f.label} non valido`;
        return false;
      }

      return true;
    }

    function showPrenotaSuccess() {
      const success = document.getElementById('prenota-success');
      if (success) {
        success.classList.add('visible');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (form) form.style.display = 'none';
    }
  }

  // Salva prenotazione in localStorage per il pannello admin
  function saveReservationToStorage(form) {
    try {
      const reservations = JSON.parse(localStorage.getItem('roccafiorita_reservations') || '[]');
      reservations.push({
        id:        'RES-' + Date.now(),
        createdAt: new Date().toISOString(),
        nome:      sanitize(form.querySelector('#prenota-nome')  ? form.querySelector('#prenota-nome').value.trim()  : ''),
        telefono:  sanitize(form.querySelector('#prenota-tel')   ? form.querySelector('#prenota-tel').value.trim()   : ''),
        data:      form.querySelector('#prenota-data')           ? form.querySelector('#prenota-data').value         : '',
        prodotto:  form.querySelector('#prenota-prodotto')       ? form.querySelector('#prenota-prodotto').value     : '',
        note:      sanitize(form.querySelector('#prenota-note')  ? form.querySelector('#prenota-note').value.trim()  : ''),
        status:    'pending',
      });
      localStorage.setItem('roccafiorita_reservations', JSON.stringify(reservations));
    } catch (_) {}
  }

  // ============================================================
  // Rate limiting lato client
  // ============================================================
  function canSubmitForm(formType) {
    const key  = `ratelimit_${formType}`;
    const last = parseInt(localStorage.getItem(key) || '0');
    const now  = Date.now();
    if (now - last < 60000) return false;
    localStorage.setItem(key, now.toString());
    return true;
  }

  // Imposta data minima prenotazione a domani
  function initDateMin() {
    const dateInput = document.getElementById('prenota-data');
    if (!dateInput) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];
  }

  // ============================================================
  // Modali legali (Privacy, Cookie, Termini)
  // ============================================================
  function initLegalModals() {
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('[data-legal]');
      if (trigger) {
        e.preventDefault();
        const key = trigger.dataset.legal;
        openLegalModal(key);
      }

      const closeBtn = e.target.closest('[data-close-legal]');
      if (closeBtn) {
        const key = closeBtn.dataset.closeLegal;
        closeLegalModal(key);
      }
    });

    document.querySelectorAll('.legal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.legal-overlay.open').forEach(el => el.classList.remove('open'));
      }
    });
  }

  function openLegalModal(key) {
    const el = document.getElementById(`modal-${key}`);
    if (el) el.classList.add('open');
  }

  function closeLegalModal(key) {
    const el = document.getElementById(`modal-${key}`);
    if (el) el.classList.remove('open');
  }

  // ============================================================
  // Cookie Banner
  // ============================================================
  function initCookieBanner() {
    const banner     = document.getElementById('cookie-banner');
    const acceptBtn  = document.getElementById('cookie-accept-btn');
    const minimalBtn = document.getElementById('cookie-minimal-btn');

    if (!banner) return;

    const consent = localStorage.getItem('cookie_consent');
    if (consent) {
      banner.classList.add('hidden');
      return;
    }

    function dismissBanner(value) {
      localStorage.setItem('cookie_consent', value);
      banner.classList.add('hidden');
    }

    if (acceptBtn)  acceptBtn.addEventListener('click',  () => dismissBanner('all'));
    if (minimalBtn) minimalBtn.addEventListener('click', () => dismissBanner('minimal'));
  }

  // ============================================================
  // Contenuti da Supabase (settings table, lettura pubblica)
  // ============================================================
  function initContentFromSupabase() {
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 5000);

    const url = CONFIG.supabase.url + '/rest/v1/settings?select=key,value';

    fetch(url, {
      headers: {
        'apikey':        CONFIG.supabase.anonKey,
        'Authorization': 'Bearer ' + CONFIG.supabase.anonKey,
      },
      signal: controller.signal,
    })
      .then(function (res) {
        clearTimeout(timeout);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        const s = {};
        rows.forEach(function (r) { s[r.key] = r.value; });
        applyContentToDOM(s);
      })
      .catch(function (err) {
        clearTimeout(timeout);
        console.warn('[Contenuti] Supabase non raggiungibile, mantengo valori HTML:', err.message);
      });
  }

  function applyContentToDOM(s) {
    // Indirizzo
    if (s.address) {
      const el = document.getElementById('indirizzo-display');
      if (el) el.textContent = s.address;
    }

    // Telefono principale
    if (s.phone_primary) {
      document.querySelectorAll('[data-content="telefono"]').forEach(function (el) {
        el.textContent = s.phone_primary;
        if (el.tagName === 'A') el.href = 'tel:' + s.phone_primary.replace(/\s/g, '');
      });
    }

    // Telefono secondario
    if (s.phone_secondary) {
      document.querySelectorAll('[data-content="telefono2"]').forEach(function (el) {
        el.textContent = s.phone_secondary;
        if (el.tagName === 'A') el.href = 'tel:' + s.phone_secondary.replace(/\s/g, '');
      });
    }

    // WhatsApp
    if (s.whatsapp_number) {
      const wa = document.getElementById('whatsapp-btn');
      if (wa) wa.href = 'https://wa.me/' + s.whatsapp_number.replace(/[^0-9]/g, '');
    }

    // Email di contatto
    if (s.email_contact) {
      document.querySelectorAll('[data-content="email"]').forEach(function (el) {
        el.textContent = s.email_contact;
        if (el.tagName === 'A') el.href = 'mailto:' + s.email_contact;
      });
    }

    // Google Maps iframe — solo URL embeddabili (non link brevi maps.app.goo.gl,
    // che non possono stare in un iframe). Sono accettati il formato classico
    // /maps/embed?pb=... e il formato ?q=lat,lng&output=embed (generato da resolve-map).
    const embeddable = s.maps_embed_url && (
      s.maps_embed_url.startsWith('https://www.google.com/maps/embed') ||
      /[?&]output=embed/.test(s.maps_embed_url)
    );
    if (embeddable) {
      const iframe = document.getElementById('maps-iframe');
      if (iframe) iframe.src = s.maps_embed_url;
    }

    // Orari di apertura
    const DAYS = [
      { key: 'hours_monday',    label: 'Lunedì'    },
      { key: 'hours_tuesday',   label: 'Martedì'   },
      { key: 'hours_wednesday', label: 'Mercoledì' },
      { key: 'hours_thursday',  label: 'Giovedì'   },
      { key: 'hours_friday',    label: 'Venerdì'   },
      { key: 'hours_saturday',  label: 'Sabato'    },
      { key: 'hours_sunday',    label: 'Domenica'  },
    ];
    const hasAnyHours = DAYS.some(function (d) { return s[d.key]; });
    if (hasAnyHours) {
      const el = document.getElementById('orari-display');
      if (el) {
        el.innerHTML = DAYS
          .filter(function (d) { return s[d.key]; })
          .map(function (d) { return sanitize(d.label) + ': ' + sanitize(s[d.key]); })
          .join('<br />');
      }
    }

    // Ragione sociale nel footer (© ... <nome>.)
    if (s.company_name) {
      const el = document.getElementById('footer-company');
      if (el) el.textContent = s.company_name;
    }

    // P.IVA nel footer
    if (s.vat_number) {
      const el = document.getElementById('footer-vat');
      if (el) el.textContent = s.vat_number;
    }

    // Documenti legali — contenuto HTML renderito dal pannello admin.
    // Se la chiave è presente ma vuota → placeholder.
    // Se la chiave non esiste affatto (Supabase mai popolato) → mantiene
    // il testo già scritto nell'HTML come fallback.
    const LEGAL = [
      { id: 'modal-privacy', key: 'privacy_policy' },
      { id: 'modal-cookie',  key: 'cookie_policy'  },
      { id: 'modal-termini', key: 'terms_conditions' },
    ];
    const PLACEHOLDER = '<p>Documento in fase di aggiornamento. Contattaci per informazioni.</p>';
    LEGAL.forEach(function (doc) {
      if (!(doc.key in s)) return; // chiave assente: lascia il fallback HTML
      const body = document.querySelector('#' + doc.id + ' .legal-modal-body');
      if (!body) return;
      const value = String(s[doc.key] || '').trim();
      body.innerHTML = value || PLACEHOLDER;
    });
  }

  // ============================================================
  // Helper: pulsante loading state
  // ============================================================
  function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Invio in corso…';
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Invia';
    }
  }

}());
