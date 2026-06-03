// checkout.js — Checkout con Stripe Elements
// Flusso in due step:
//   1. Cliente compila dati spedizione → "Procedi al pagamento"
//      → chiama create-payment-intent → riceve clientSecret + totale server
//   2. Appare form carta Stripe → "Paga €X,XX"
//      → stripe.confirmCardPayment → successo/errore
// Dipende da: config.js, cart.js

(function () {
  'use strict';

  let stripe         = null;
  let cardElement    = null;
  let cardMounted    = false;
  let clientSecret   = null;
  let serverTotal    = null;
  let serverShipping = null;
  let step           = 'shipping'; // 'shipping' | 'payment' | 'done'

  // ============================================================
  // Inizializzazione
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    initStripe();
    bindCheckoutEvents();
    bindDoneBtn();
  });

  // ============================================================
  // Stripe Elements
  // ============================================================
  function initStripe() {
    if (typeof Stripe === 'undefined') {
      console.warn('[Checkout] Stripe.js non caricato');
      return;
    }
    if (!CONFIG.stripe.publishableKey) {
      console.warn('[Checkout] publishableKey mancante in config.js');
      return;
    }

    stripe = Stripe(CONFIG.stripe.publishableKey);

    const elements = stripe.elements({
      fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Lora&display=swap' }],
    });

    const appearance = {
      theme: 'stripe',
      variables: {
        colorPrimary:     '#A07830',
        colorBackground:  '#FDFAF4',
        colorText:        '#1C1009',
        colorDanger:      '#A03020',
        fontFamily:       'Lora, Georgia, serif',
        borderRadius:     '4px',
      },
    };

    cardElement = elements.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          fontFamily:    "'Lora', Georgia, serif",
          fontSize:      '15px',
          color:         '#1C1009',
          '::placeholder': { color: '#7A6550' },
          iconColor:     '#A07830',
        },
        invalid: {
          color:     '#A03020',
          iconColor: '#A03020',
        },
      },
    });

    // NON montare qui: il container è display:none e Stripe non si inizializza.
    // Il mount avviene in showPaymentStep() dopo che il container è visibile.
    cardElement.addEventListener('change', function (e) {
      const errEl = document.getElementById('stripe-card-errors');
      if (errEl) errEl.textContent = e.error ? e.error.message : '';
    });
  }

  // ============================================================
  // Riepilogo ordine nel modal
  // ============================================================
  function renderCheckoutSummary(overrideShipping) {
    const summaryEl = document.getElementById('checkout-summary');
    if (!summaryEl) return;

    const items    = Cart.getItems();
    const subtotal = Cart.getSubtotal();
    const shipping = overrideShipping !== undefined ? overrideShipping : Cart.getShipping();
    const total    = subtotal + shipping;

    if (items.length === 0) {
      summaryEl.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.9rem;">Carrello vuoto.</p>';
      return;
    }

    const rows = items.map(item => `
      <div class="checkout-order-item">
        <span>${sanitize(item.name)} × ${item.quantity} conf.</span>
        <span>€${item.subtotal.toFixed(2)}</span>
      </div>`).join('');

    const shippingLabel = shipping === 0
      ? '<span style="color:var(--color-gold)">Gratuita</span>'
      : '€' + shipping.toFixed(2);

    summaryEl.innerHTML = `
      ${rows}
      <div class="checkout-totals">
        <div class="checkout-total-row">
          <span>Subtotale</span>
          <span>€${subtotal.toFixed(2)}</span>
        </div>
        <div class="checkout-total-row">
          <span>Spedizione</span>
          <span>${shippingLabel}</span>
        </div>
        <div class="checkout-total-row grand">
          <span>Totale</span>
          <span>€${total.toFixed(2)}</span>
        </div>
      </div>`;
  }

  // ============================================================
  // Gestione step UI
  // ============================================================
  function showShippingStep() {
    step = 'shipping';
    const cardWrap = document.getElementById('stripe-card-wrap');
    const payBtn   = document.getElementById('stripe-pay-btn');
    if (cardWrap) cardWrap.style.display = 'none';
    if (payBtn)   { payBtn.disabled = false; payBtn.textContent = 'Procedi al pagamento'; }
  }

  function showPaymentStep() {
    step = 'payment';
    const cardWrap = document.getElementById('stripe-card-wrap');
    if (cardWrap) cardWrap.style.display = '';

    // Monta il card element solo ora che il container è visibile
    if (cardElement && !cardMounted) {
      cardElement.mount('#stripe-card-element');
      cardMounted = true;
    }

    const payBtn = document.getElementById('stripe-pay-btn');
    if (payBtn) {
      payBtn.disabled    = false;
      payBtn.textContent = serverTotal ? `Paga €${serverTotal.toFixed(2)}` : 'Paga ora';
    }
  }

  // ============================================================
  // Binding eventi
  // ============================================================
  function bindCheckoutEvents() {
    // Reset al (ri)apertura del modal
    document.addEventListener('checkout:opened', function () {
      clientSecret   = null;
      serverTotal    = null;
      serverShipping = null;
      cardMounted    = false;
      showShippingStep();
      renderCheckoutSummary();
    });

    // Click sul bottone principale (cambia comportamento in base allo step)
    const payBtn = document.getElementById('stripe-pay-btn');
    if (payBtn) {
      payBtn.addEventListener('click', function () {
        if (step === 'shipping') handleProceed();
        else if (step === 'payment') handlePay();
      });
    }
  }

  // ============================================================
  // Step 1: valida form → chiama create-payment-intent
  // ============================================================
  async function handleProceed() {
    const validation = validateCheckoutFields();
    if (!validation.valid) return;

    if (!stripe) {
      showCheckoutError('Stripe non è disponibile. Ricarica la pagina.');
      return;
    }

    const payBtn = document.getElementById('stripe-pay-btn');
    setButtonLoading(payBtn, true, 'Calcolo in corso…');
    clearCheckoutError();

    const items        = Cart.getItems();
    const customerData = buildCustomerData();

    try {
      const res = await fetch('/.netlify/functions/create-payment-intent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items, customerData }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Errore durante la preparazione del pagamento');

      clientSecret   = data.clientSecret;
      serverTotal    = data.total;
      serverShipping = data.shipping;

      renderCheckoutSummary(serverShipping);
      showPaymentStep();

    } catch (err) {
      showCheckoutError(err.message || 'Errore di rete. Riprova tra qualche istante.');
      setButtonLoading(payBtn, false, 'Procedi al pagamento');
    }
  }

  // ============================================================
  // Step 2: conferma pagamento Stripe
  // ============================================================
  async function handlePay() {
    if (!stripe || !cardElement || !clientSecret) {
      showCheckoutError('Stripe non disponibile. Ricarica la pagina e riprova.');
      return;
    }

    const payBtn = document.getElementById('stripe-pay-btn');
    setButtonLoading(payBtn, true, 'Elaborazione pagamento…');
    clearCheckoutError();

    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card:             cardElement,
        billing_details:  {
          name:  `${getField('co-nome')} ${getField('co-cognome')}`.trim(),
          email: getField('co-email'),
        },
      },
    });

    if (error) {
      // Errore carta: mostra messaggio, permetti di riprovare
      showCheckoutError(error.message);
      setButtonLoading(payBtn, false, serverTotal ? `Paga €${serverTotal.toFixed(2)}` : 'Paga ora');
      return;
    }

    // Pagamento riuscito — il webhook gestisce salvataggio ordine ed email
    step = 'done';
    Cart.clear();
    showCheckoutSuccess(getField('co-email'));
  }

  // ============================================================
  // Costruisce oggetto customerData dai campi del form
  // ============================================================
  function buildCustomerData() {
    return {
      name:    `${getField('co-nome')} ${getField('co-cognome')}`.trim(),
      email:   getField('co-email'),
      phone:   getField('co-telefono') || '',
      address: {
        street:   getField('co-indirizzo'),
        city:     getField('co-citta'),
        zip:      getField('co-cap'),
        province: getField('co-provincia') || '',
        country:  'IT',
      },
    };
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

    if (!valid) {
      const firstInvalid = document.querySelector('.checkout-fields .invalid');
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return { valid };
  }

  // ============================================================
  // Helpers UI
  // ============================================================
  function getField(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  function setButtonLoading(btn, loading, text) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${text || 'Elaborazione…'}`;
    } else {
      btn.disabled    = false;
      btn.textContent = text || btn.dataset.originalText || 'Procedi al pagamento';
    }
  }

  function showCheckoutSuccess(email) {
    const formWrap  = document.getElementById('checkout-form-wrap');
    const successEl = document.getElementById('checkout-success');

    if (successEl) {
      const msgEl = successEl.querySelector('p');
      if (msgEl) {
        msgEl.innerHTML =
          'Ti abbiamo inviato una email di conferma a ' +
          `<strong>${sanitize(email || '')}</strong>.`;
      }
    }

    if (formWrap)  formWrap.style.display  = 'none';
    if (successEl) successEl.classList.add('visible');
  }

  function showCheckoutError(message) {
    let errEl = document.getElementById('checkout-global-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'checkout-global-error';
      errEl.setAttribute('role', 'alert');
      errEl.style.cssText = [
        'margin:1rem 0',
        'padding:0.75rem 1rem',
        'background:#FEF2F2',
        'border:1px solid #FCA5A5',
        'border-radius:6px',
        'color:#A03020',
        'font-size:0.875rem',
        'line-height:1.5',
      ].join(';');
      const payBtn = document.getElementById('stripe-pay-btn');
      if (payBtn && payBtn.parentNode) payBtn.parentNode.insertBefore(errEl, payBtn);
    }
    errEl.textContent   = message;
    errEl.style.display = 'block';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearCheckoutError() {
    const errEl = document.getElementById('checkout-global-error');
    if (errEl) errEl.style.display = 'none';
  }

  // ============================================================
  // Bottone "Chiudi" nella schermata successo
  // ============================================================
  function bindDoneBtn() {
    const doneBtn = document.getElementById('checkout-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        document.dispatchEvent(new CustomEvent('checkout:close'));
      });
    }
  }

  // Esponi funzione per resettare il form (usata da main.js)
  window.CheckoutResetForm = function () {
    const formWrap  = document.getElementById('checkout-form-wrap');
    const successEl = document.getElementById('checkout-success');
    if (formWrap)  formWrap.style.display = '';
    if (successEl) successEl.classList.remove('visible');
    clearCheckoutError();
    showShippingStep();
  };

}());
