// checkout.js — Integrazione Stripe Elements + PayPal SDK dinamico
// Dipende da: config.js, cart.js

(function () {
  'use strict';

  let stripe = null;
  let cardElement = null;
  let paypalLoaded = false;

  // ============================================================
  // Inizializzazione — attende DOMContentLoaded
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    initStripe();
    loadPaypalSdk();
    bindCheckoutSummaryUpdate();
  });

  // ============================================================
  // Riepilogo ordine nel modal (aggiornato ad ogni apertura)
  // ============================================================
  function bindCheckoutSummaryUpdate() {
    document.addEventListener('checkout:opened', renderCheckoutSummary);
  }

  function renderCheckoutSummary() {
    const summaryEl = document.getElementById('checkout-summary');
    if (!summaryEl) return;

    const items    = Cart.getItems();
    const subtotal = Cart.getSubtotal();
    const shipping = Cart.getShipping();
    const total    = Cart.getTotal();

    if (items.length === 0) {
      summaryEl.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.9rem;">Carrello vuoto.</p>';
      return;
    }

    const rows = items.map(item => `
      <div class="checkout-order-item">
        <span>${item.name} × ${item.kg} ${item.unit || 'cad.'}</span>
        <span>€${(item.pricePerKg * item.kg).toFixed(2)}</span>
      </div>`).join('');

    summaryEl.innerHTML = `
      ${rows}
      <div class="checkout-totals">
        <div class="checkout-total-row">
          <span>Subtotale</span>
          <span>€${subtotal.toFixed(2)}</span>
        </div>
        <div class="checkout-total-row">
          <span>Spedizione</span>
          <span>${shipping === 0 ? '<span style="color:var(--color-gold)">Gratuita</span>' : '€' + shipping.toFixed(2)}</span>
        </div>
        <div class="checkout-total-row grand">
          <span>Totale</span>
          <span>€${total.toFixed(2)}</span>
        </div>
      </div>`;
  }

  // ============================================================
  // Stripe Elements
  // ============================================================
  function initStripe() {
    if (typeof Stripe === 'undefined') return;

    const key = CONFIG.stripe.publishableKey;
    if (!key || key === 'pk_test_XXXX') {
      // Stripe non configurato — mostra avviso solo in development
      console.warn('[Checkout] Stripe publishableKey non configurata. Aggiorna js/config.js.');
      disableStripeUI();
      return;
    }

    stripe = Stripe(key);
    const elements = stripe.elements({
      fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Lora&display=swap' }],
    });

    cardElement = elements.create('card', {
      style: {
        base: {
          fontFamily: "'Lora', Georgia, serif",
          fontSize: '15px',
          color: '#1C1009',
          '::placeholder': { color: '#7A6550' },
          iconColor: '#A07830',
        },
        invalid: {
          color: '#B84C4C',
          iconColor: '#B84C4C',
        },
      },
    });

    cardElement.mount('#stripe-card-element');

    cardElement.addEventListener('change', function (event) {
      const errEl = document.getElementById('stripe-card-errors');
      if (errEl) errEl.textContent = event.error ? event.error.message : '';
    });

    // Pulsante "Paga ora"
    const payBtn = document.getElementById('stripe-pay-btn');
    if (payBtn) {
      payBtn.addEventListener('click', handleStripePayment);
    }
  }

  function disableStripeUI() {
    const cardEl = document.getElementById('stripe-card-element');
    const payBtn = document.getElementById('stripe-pay-btn');
    if (cardEl) {
      cardEl.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.85rem; padding:0.75rem 0;">⚠️ Pagamento con carta non configurato — aggiorna config.js con la tua chiave Stripe.</p>';
    }
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.style.opacity = '0.5';
    }
  }

  async function handleStripePayment() {
    if (!stripe || !cardElement) return;

    const validation = validateCheckoutFields();
    if (!validation.valid) return;

    const payBtn = document.getElementById('stripe-pay-btn');
    setButtonLoading(payBtn, true);

    // In produzione qui si chiama il backend per creare il PaymentIntent
    // e si usa il client_secret per confirmCardPayment.
    // Per il MVP (test mode) simuliamo la conferma con confirmCardPayment senza secret.
    const { error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: `${getField('co-nome')} ${getField('co-cognome')}`,
        email: getField('co-email'),
        address: {
          line1:       getField('co-indirizzo'),
          city:        getField('co-citta'),
          postal_code: getField('co-cap'),
          country:     'IT',
        },
      },
    });

    if (error) {
      const errEl = document.getElementById('stripe-card-errors');
      if (errEl) errEl.textContent = error.message;
      setButtonLoading(payBtn, false);
      return;
    }

    // Registra ordine in localStorage (dashboard admin) e invia a Formspree
    recordOrderToStorage('stripe', null);
    await sendOrderToFormspree('stripe', null);

    showCheckoutSuccess();
    setButtonLoading(payBtn, false);
  }

  // ============================================================
  // PayPal SDK — caricato dinamicamente
  // ============================================================
  function loadPaypalSdk() {
    const clientId = CONFIG.paypal.clientId;
    if (!clientId || clientId === 'XXXX') {
      console.warn('[Checkout] PayPal clientId non configurato. Aggiorna js/config.js.');
      showPaypalPlaceholder();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${CONFIG.paypal.currency}&intent=capture`;
    script.onload = initPaypalButtons;
    script.onerror = function () {
      console.warn('[Checkout] Errore nel caricamento PayPal SDK.');
      showPaypalPlaceholder();
    };
    document.head.appendChild(script);
  }

  function showPaypalPlaceholder() {
    const container = document.getElementById('paypal-button-container');
    if (container) {
      container.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.85rem; padding:0.5rem 0;">⚠️ PayPal non configurato — aggiorna config.js con il tuo client ID.</p>';
    }
  }

  function initPaypalButtons() {
    if (paypalLoaded || typeof paypal === 'undefined') return;
    paypalLoaded = true;

    paypal.Buttons({
      style: {
        layout:  'vertical',
        color:   'gold',
        shape:   'rect',
        label:   'paypal',
        height:  44,
      },
      createOrder: function (data, actions) {
        const validation = validateCheckoutFields();
        if (!validation.valid) return Promise.reject(new Error('Dati mancanti'));

        return actions.order.create({
          purchase_units: [{
            amount: {
              value:         Cart.getTotal().toFixed(2),
              currency_code: CONFIG.paypal.currency,
            },
            description: 'Ordine Panificio Roccafiorita',
          }],
          payer: {
            name: {
              given_name: getField('co-nome'),
              surname:    getField('co-cognome'),
            },
            email_address: getField('co-email'),
          },
        });
      },
      onApprove: async function (data, actions) {
        await actions.order.capture();
        recordOrderToStorage('paypal', data.orderID);
        await sendOrderToFormspree('paypal', data.orderID);
        showCheckoutSuccess();
      },
      onError: function (err) {
        console.error('[PayPal] Errore:', err);
      },
    }).render('#paypal-button-container');
  }

  // ============================================================
  // Registrazione ordine in localStorage (per dashboard admin)
  // ============================================================
  function recordOrderToStorage(method, paymentRef) {
    try {
      const items    = Cart.getItems();
      const total    = Cart.getTotal();
      const shipping = Cart.getShipping();

      const orderItems = items.map(i => ({
        productId:   i.id,
        productName: i.name,
        kg:          i.kg,
        pricePerKg:  i.pricePerKg,
        subtotal:    parseFloat((i.kg * i.pricePerKg).toFixed(2)),
      }));

      // Genera ID ordine: ORD-YYYYMMDD-timestamp
      const now    = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const orderId  = `ORD-${datePart}-${Date.now() % 100000}`;

      const order = {
        id:       orderId,
        date:     now.toISOString(),
        customer: {
          name:  `${getField('co-nome')} ${getField('co-cognome')}`,
          email: getField('co-email'),
          city:  getField('co-citta'),
        },
        items:    orderItems,
        shipping: shipping,
        total:    parseFloat(total.toFixed(2)),
        paymentMethod: method,
        paymentId:     paymentRef || '—',
        status:        'paid',
      };

      const orders = JSON.parse(localStorage.getItem('roccafiorita_sales') || '[]');
      orders.push(order);
      localStorage.setItem('roccafiorita_sales', JSON.stringify(orders));
    } catch (err) {
      console.warn('[Checkout] Impossibile salvare ordine in localStorage:', err);
    }
  }

  // ============================================================
  // Invio notifica ordine a Formspree
  // ============================================================
  async function sendOrderToFormspree(method, paymentRef) {
    const endpoint = CONFIG.formspree.orderEndpoint;
    if (!endpoint || endpoint.includes('XXXXXXXX')) return; // non configurato

    const items    = Cart.getItems();
    const total    = Cart.getTotal();
    const shipping = Cart.getShipping();

    const orderLines = items.map(i =>
      `${i.name}: ${i.kg} ${i.unit || 'cad.'} × €${i.pricePerKg}/${i.unit || 'cad.'} = €${(i.kg * i.pricePerKg).toFixed(2)}`
    ).join('\n');

    const payload = {
      nome:          `${getField('co-nome')} ${getField('co-cognome')}`,
      email:         getField('co-email'),
      indirizzo:     `${getField('co-indirizzo')}, ${getField('co-cap')} ${getField('co-citta')}`,
      metodo_pagamento: method,
      riferimento_pagamento: paymentRef || '—',
      ordine:        orderLines,
      spedizione:    shipping === 0 ? 'Gratuita' : `€${shipping.toFixed(2)}`,
      totale:        `€${total.toFixed(2)}`,
    };

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[Checkout] Formspree non raggiungibile:', err);
    }
  }

  // ============================================================
  // Validazione campi checkout
  // ============================================================
  function validateCheckoutFields() {
    const fields = [
      { id: 'co-nome',      label: 'Nome',      required: true },
      { id: 'co-cognome',   label: 'Cognome',   required: true },
      { id: 'co-email',     label: 'Email',     required: true, type: 'email' },
      { id: 'co-indirizzo', label: 'Indirizzo', required: true },
      { id: 'co-citta',     label: 'Città',     required: true },
      { id: 'co-cap',       label: 'CAP',       required: true, pattern: /^\d{5}$/ },
    ];

    let valid = true;

    fields.forEach(f => {
      const el  = document.getElementById(f.id);
      const err = document.getElementById(f.id + '-err');
      if (!el) return;

      el.classList.remove('invalid');
      if (err) err.textContent = '';

      const val = el.value.trim();

      if (f.required && !val) {
        valid = false;
        el.classList.add('invalid');
        if (err) err.textContent = `${f.label} obbligatorio`;
        return;
      }

      if (f.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        valid = false;
        el.classList.add('invalid');
        if (err) err.textContent = 'Email non valida';
        return;
      }

      if (f.pattern && val && !f.pattern.test(val)) {
        valid = false;
        el.classList.add('invalid');
        if (err) err.textContent = `${f.label} non valido`;
      }
    });

    return { valid };
  }

  // ============================================================
  // Helpers UI
  // ============================================================
  function getField(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Elaborazione…';
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Paga ora';
    }
  }

  function showCheckoutSuccess() {
    Cart.clear();
    const formWrap = document.getElementById('checkout-form-wrap');
    const successEl = document.getElementById('checkout-success');
    if (formWrap) formWrap.style.display = 'none';
    if (successEl) successEl.classList.add('visible');
  }

  // Bottone "Chiudi" nella schermata successo
  document.addEventListener('DOMContentLoaded', function () {
    const doneBtn = document.getElementById('checkout-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        document.dispatchEvent(new CustomEvent('checkout:close'));
      });
    }
  });

  // Esponi funzione per riaprire il form (usata da main.js dopo svuotamento)
  window.CheckoutResetForm = function () {
    const formWrap = document.getElementById('checkout-form-wrap');
    const successEl = document.getElementById('checkout-success');
    if (formWrap) formWrap.style.display = '';
    if (successEl) successEl.classList.remove('visible');
  };

}());
