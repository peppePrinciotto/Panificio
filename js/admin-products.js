// admin-products.js — Gestione prodotti nel pannello admin
// Legge/scrive su localStorage['roccafiorita_products']

(function () {
  'use strict';

  const STORAGE_KEY = 'roccafiorita_products';

  // ============================================================
  // Storage
  // ============================================================
  function getProducts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    // Fallback ai prodotti di CONFIG
    return CONFIG.products.map(p => ({
      id:               p.id,
      name:             p.name,
      shortDescription: p.description || '',
      longDescription:  '',
      pricePerKg:       p.pricePerKg,
      minKg:            Math.max(1, Math.round(p.minKg || 1)),
      weight:           p.weight || '',
      weightG:          p.weightG || null,
      available:        true,
      stock:            null, // null = illimitato
      imageUrl:         p.imageUrl || '',
      placeholderColor: p.placeholderColor || '#C4A882',
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
    }));
  }

  function saveProducts(products) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ============================================================
  // Render lista prodotti
  // ============================================================
  function renderProductList() {
    const container = document.getElementById('products-content');
    if (!container) return;

    const products = getProducts();

    container.innerHTML = `
      <div class="product-list-header">
        <h2>Prodotti (${products.length})</h2>
        <button class="btn-admin btn-primary" id="add-product-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Aggiungi nuovo
        </button>
      </div>

      <div class="info-banner">
        <strong>Come funziona:</strong> le modifiche si riflettono sul sito al prossimo caricamento della pagina.
        Le prenotazioni visibili nell'admin sono quelle ricevute da <em>questo browser</em>.
      </div>

      <div id="product-list">
        ${products.length === 0 ? renderEmptyState('Nessun prodotto. Aggiungine uno.') : products.map(renderProductCard).join('')}
      </div>`;

    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null));

    container.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const product = getProducts().find(p => p.id === id);
        if (product) openProductModal(product);
      });
    });

    container.querySelectorAll('.toggle-available-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id       = btn.dataset.id;
        const products = getProducts();
        const product  = products.find(p => p.id === id);
        if (product) {
          product.available = !product.available;
          product.updatedAt = new Date().toISOString();
          saveProducts(products);
          renderProductList();
        }
      });
    });
  }

  function renderProductCard(p) {
    const availBadge = p.available !== false
      ? '<span class="badge badge-success">Visibile</span>'
      : '<span class="badge badge-muted">Nascosto</span>';

    const stock = p.stock !== null && p.stock !== undefined ? parseInt(p.stock) : null;
    const stockBadge = stock === null
      ? ''
      : stock === 0
        ? '<span class="badge badge-danger">Esaurito</span>'
        : `<span class="badge badge-warning">Stock: ${stock}</span>`;

    const weightLabel = p.weightG ? `<span class="badge badge-muted">${p.weightG} g</span>` : '';
    const toggleLabel = p.available !== false ? 'Nascondi' : 'Rendi visibile';

    const thumb = p.imageUrl
      ? `<img class="product-img-thumb" src="${sanitize(p.imageUrl)}" alt="${sanitize(p.name)}" loading="lazy" />`
      : `<div class="product-img-thumb" style="background:${sanitize(p.placeholderColor || '#C4A882')};"></div>`;

    return `
      <div class="product-card-admin">
        ${thumb}
        <div class="product-info">
          <div class="product-info-name">${sanitize(p.name)}</div>
          <div class="product-info-desc">${sanitize(p.shortDescription || '')}</div>
        </div>
        <div class="product-info-price">€${parseFloat(p.pricePerKg).toFixed(2)}/cad.</div>
        ${weightLabel}
        ${availBadge}
        ${stockBadge}
        <div class="product-actions">
          <button class="btn-admin btn-ghost btn-sm edit-product-btn" data-id="${sanitize(p.id)}">Modifica</button>
          <button class="btn-admin btn-ghost btn-sm toggle-available-btn" data-id="${sanitize(p.id)}">${toggleLabel}</button>
        </div>
      </div>`;
  }

  function renderEmptyState(msg) {
    return `<div class="empty-state"><p>${sanitize(msg)}</p></div>`;
  }

  // ============================================================
  // Modal Prodotto
  // ============================================================
  function openProductModal(product) {
    const overlay    = document.getElementById('product-modal-overlay');
    const titleEl    = document.getElementById('product-modal-title');
    const deleteBtn  = document.getElementById('product-delete-btn');

    if (!overlay) return;

    // Reset form
    const form = document.getElementById('product-form');
    if (form) form.reset();

    // Pulizia errori
    ['p-name', 'p-price', 'p-shortdesc'].forEach(id => {
      const errEl = document.getElementById(id + '-err');
      if (errEl) errEl.textContent = '';
      const el = document.getElementById(id);
      if (el) el.classList.remove('invalid');
    });

    if (product) {
      // Modifica prodotto esistente
      titleEl.textContent = 'Modifica Prodotto';
      document.getElementById('product-id-field').value = product.id;
      document.getElementById('p-name').value            = product.name || '';
      document.getElementById('p-price').value           = product.pricePerKg || '';
      document.getElementById('p-shortdesc').value       = product.shortDescription || '';
      document.getElementById('p-longdesc').value        = product.longDescription || '';
      document.getElementById('p-minkg').value           = Math.max(1, Math.round(product.minKg || 1));
      document.getElementById('p-weight').value          = product.weightG || '';
      document.getElementById('p-stock').value           = (product.stock !== null && product.stock !== undefined) ? product.stock : '';
      document.getElementById('p-available').checked    = product.available !== false;
      setImagePreview(product.imageUrl || null);
      if (deleteBtn) deleteBtn.style.display = '';
    } else {
      // Nuovo prodotto
      titleEl.textContent = 'Aggiungi Prodotto';
      document.getElementById('product-id-field').value = '';
      document.getElementById('p-weight').value          = '';
      document.getElementById('p-stock').value           = '';
      document.getElementById('p-available').checked    = true;
      setImagePreview(null);
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    updateCharCounter();
    overlay.style.display = 'flex';
    document.getElementById('p-name').focus();
  }

  function closeProductModal() {
    const overlay = document.getElementById('product-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ============================================================
  // Immagine: anteprima & upload
  // ============================================================
  function setImagePreview(dataUrl) {
    const area    = document.getElementById('img-upload-area');
    const preview = document.getElementById('p-img-preview');
    const prompt  = document.getElementById('img-upload-prompt');
    const removeBtn = document.getElementById('img-remove-btn');
    const hidden  = document.getElementById('p-imageurl');

    if (dataUrl) {
      preview.src = dataUrl;
      preview.style.display = 'block';
      prompt.style.display  = 'none';
      area.classList.add('has-image');
      removeBtn.style.display = '';
      hidden.value = dataUrl;
    } else {
      preview.src = '';
      preview.style.display = 'none';
      prompt.style.display  = '';
      area.classList.remove('has-image');
      removeBtn.style.display = 'none';
      hidden.value = '';
    }
  }

  function resizeAndConvert(file, callback) {
    const MAX = 800;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function initImageUpload() {
    const area       = document.getElementById('img-upload-area');
    const fileInput  = document.getElementById('p-imageupload');
    const removeBtn  = document.getElementById('img-remove-btn');

    if (!area || !fileInput) return;

    area.addEventListener('click', function (e) {
      if (e.target === removeBtn || removeBtn.contains(e.target)) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('Immagine troppo grande. Massimo 5 MB.');
        return;
      }
      resizeAndConvert(file, setImagePreview);
      fileInput.value = '';
    });

    area.addEventListener('dragover', function (e) {
      e.preventDefault();
      area.classList.add('drag-over');
    });

    area.addEventListener('dragleave', function () {
      area.classList.remove('drag-over');
    });

    area.addEventListener('drop', function (e) {
      e.preventDefault();
      area.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      resizeAndConvert(file, setImagePreview);
    });

    removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setImagePreview(null);
    });
  }

  // ============================================================
  // Contatore caratteri descrizione breve
  // ============================================================
  function updateCharCounter() {
    const textarea = document.getElementById('p-shortdesc');
    const counter  = document.getElementById('p-shortdesc-count');
    if (textarea && counter) {
      counter.textContent = textarea.value.length;
    }
  }

  // ============================================================
  // Salva prodotto
  // ============================================================
  function saveProduct(formData) {
    const products = getProducts();
    const existingId = formData.id;

    const now = new Date().toISOString();

    if (existingId) {
      // Aggiorna esistente
      const idx = products.findIndex(p => p.id === existingId);
      if (idx >= 0) {
        products[idx] = Object.assign(products[idx], {
          name:             formData.name,
          shortDescription: formData.shortDescription,
          longDescription:  formData.longDescription,
          pricePerKg:       formData.pricePerKg,
          minKg:            formData.minKg,
          weightG:          formData.weightG,
          stock:            formData.stock,
          available:        formData.available,
          imageUrl:         formData.imageUrl,
          updatedAt:        now,
        });
      }
    } else {
      // Crea nuovo
      const newId = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      products.push({
        id:               newId + '-' + Date.now() % 10000,
        name:             formData.name,
        shortDescription: formData.shortDescription,
        longDescription:  formData.longDescription,
        pricePerKg:       formData.pricePerKg,
        minKg:            formData.minKg,
        weightG:          formData.weightG,
        stock:            formData.stock,
        available:        formData.available,
        imageUrl:         formData.imageUrl,
        placeholderColor: '#C4A882',
        createdAt:        now,
        updatedAt:        now,
      });
    }

    saveProducts(products);
    closeProductModal();
    renderProductList();
  }

  // ============================================================
  // Elimina prodotto
  // ============================================================
  function deleteProduct(id) {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return;
    const products = getProducts().filter(p => p.id !== id);
    saveProducts(products);
    closeProductModal();
    renderProductList();
  }

  // ============================================================
  // Validazione form prodotto
  // ============================================================
  function validateProductForm() {
    let valid = true;

    const nameEl = document.getElementById('p-name');
    const nameErr = document.getElementById('p-name-err');
    if (!nameEl.value.trim()) {
      nameEl.classList.add('invalid');
      if (nameErr) nameErr.textContent = 'Nome obbligatorio';
      valid = false;
    } else {
      nameEl.classList.remove('invalid');
      if (nameErr) nameErr.textContent = '';
    }

    const priceEl = document.getElementById('p-price');
    const priceErr = document.getElementById('p-price-err');
    const price = parseFloat(priceEl.value);
    if (isNaN(price) || price < 0.5) {
      priceEl.classList.add('invalid');
      if (priceErr) priceErr.textContent = 'Prezzo non valido (min €0.50)';
      valid = false;
    } else {
      priceEl.classList.remove('invalid');
      if (priceErr) priceErr.textContent = '';
    }

    const descEl = document.getElementById('p-shortdesc');
    const descErr = document.getElementById('p-shortdesc-err');
    if (!descEl.value.trim()) {
      descEl.classList.add('invalid');
      if (descErr) descErr.textContent = 'Descrizione breve obbligatoria';
      valid = false;
    } else {
      descEl.classList.remove('invalid');
      if (descErr) descErr.textContent = '';
    }

    return valid;
  }

  // ============================================================
  // Inizializzazione event listeners modal
  // ============================================================
  function initModalEvents() {
    const overlay   = document.getElementById('product-modal-overlay');
    const closeBtn  = document.getElementById('product-modal-close');
    const cancelBtn = document.getElementById('product-cancel-btn');
    const deleteBtn = document.getElementById('product-delete-btn');
    const form      = document.getElementById('product-form');
    const shortdesc = document.getElementById('p-shortdesc');

    if (closeBtn)  closeBtn.addEventListener('click', closeProductModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeProductModal);

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeProductModal();
      });
    }

    if (shortdesc) {
      shortdesc.addEventListener('input', updateCharCounter);
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        const id = document.getElementById('product-id-field').value;
        if (id) deleteProduct(id);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateProductForm()) return;

        const stockRaw = document.getElementById('p-stock').value.trim();
        saveProduct({
          id:               document.getElementById('product-id-field').value,
          name:             document.getElementById('p-name').value.trim(),
          shortDescription: document.getElementById('p-shortdesc').value.trim(),
          longDescription:  document.getElementById('p-longdesc').value.trim(),
          pricePerKg:       parseFloat(document.getElementById('p-price').value),
          minKg:            parseInt(document.getElementById('p-minkg').value, 10) || 1,
          weightG:          document.getElementById('p-weight').value.trim() === '' ? null : parseInt(document.getElementById('p-weight').value, 10),
          stock:            stockRaw === '' ? null : parseInt(stockRaw, 10),
          available:        document.getElementById('p-available').checked,
          imageUrl:         document.getElementById('p-imageurl').value.trim(),
        });
      });
    }

    // Chiudi con ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
        closeProductModal();
      }
    });
  }

  // ============================================================
  // Punto di ingresso
  // ============================================================
  document.addEventListener('admin:ready', function () {
    initModalEvents();
    initImageUpload();
  });

  document.addEventListener('admin:navigate', function (e) {
    if (e.detail.section === 'products') {
      renderProductList();
    }
  });

}());
