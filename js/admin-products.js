// admin-products.js — Gestione prodotti nel pannello admin
// Legge/scrive su Supabase via /.netlify/functions/admin-data

(function () {
  'use strict';

  const API = '/.netlify/functions/admin-data';

  // ============================================================
  // Helper API
  // ============================================================
  function authHeaders() {
    const token = sessionStorage.getItem('admin_token') || '';
    console.log('[products] Token inviato:', token ? 'presente' : 'NULLO',
      '| Primi 8:', token ? token.substring(0, 8) : 'N/A');
    return {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
    };
  }

  function apiFetch(method, params, body) {
    const url = API + '?' + new URLSearchParams(params).toString();
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Errore API (' + res.status + ')');
        return data;
      });
    });
  }

  function getProducts() {
    return apiFetch('GET', { action: 'products' });
  }

  function createProduct(data) {
    return apiFetch('POST', { action: 'product' }, data);
  }

  function updateProduct(id, data) {
    return apiFetch('PUT', { action: 'product', id: id }, data);
  }

  function deleteProduct(id) {
    return apiFetch('DELETE', { action: 'product', id: id });
  }

  function seedProducts(products) {
    return apiFetch('POST', { action: 'seed-products' }, { products: products });
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // ============================================================
  // Render lista prodotti
  // ============================================================
  function renderProductList(products) {
    const container = document.getElementById('products-content');
    if (!container) return;

    container.innerHTML = `
      <div class="product-list-header">
        <h2>Prodotti (${products.length})</h2>
        <button class="btn-admin btn-primary" id="add-product-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Aggiungi nuovo
        </button>
      </div>

      <div id="product-list">
        ${products.length === 0 ? renderEmptyState('Nessun prodotto. Aggiungine uno.') : products.map(renderProductCard).join('')}
      </div>`;

    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null));

    container.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const product = products.find(p => p.id === btn.dataset.id);
        if (product) openProductModal(product);
      });
    });

    container.querySelectorAll('.toggle-available-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const product = products.find(p => p.id === btn.dataset.id);
        if (!product) return;
        const updated = Object.assign({}, product, {
          available: !product.available,
        });
        setLoadingState(true);
        updateProduct(product.id, updated)
          .then(() => loadAndRender())
          .catch(err => { alert('Errore: ' + err.message); setLoadingState(false); });
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
      : `<div class="product-img-thumb" style="background:#C4A882;"></div>`;

    return `
      <div class="product-card-admin">
        ${thumb}
        <div class="product-info">
          <div class="product-info-name">${sanitize(p.name)}</div>
          <div class="product-info-desc">${sanitize(p.description || '')}</div>
        </div>
        <div class="product-info-price">€${parseFloat(p.price).toFixed(2)}/conf.</div>
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

  function setLoadingState(loading) {
    const list = document.getElementById('product-list');
    if (!list) return;
    if (loading) {
      list.style.opacity = '0.5';
      list.style.pointerEvents = 'none';
    } else {
      list.style.opacity = '';
      list.style.pointerEvents = '';
    }
  }

  // ============================================================
  // Carica e renderizza (fetch + seed se vuoto)
  // ============================================================
  function loadAndRender() {
    const container = document.getElementById('products-content');
    if (!container) return;

    container.innerHTML = '<div class="loading-state" style="padding:2rem; text-align:center; color:var(--color-text-muted);">Caricamento prodotti…</div>';

    getProducts()
      .then(function (products) {
        if (products.length === 0) {
          // Prima volta: popola con i prodotti di default
          const defaults = CONFIG.products.map(p => ({
            id:          p.id,
            name:        p.name,
            description: p.description || '',
            price:       p.price,
            weightG:     p.weight_g || p.weightG || null,
            stock:       null,
            available:   true,
            imageUrl:    p.imageUrl || '',
          }));
          return seedProducts(defaults).then(() => getProducts());
        }
        return products;
      })
      .then(function (products) {
        renderProductList(products);
      })
      .catch(function (err) {
        if (container) {
          container.innerHTML = `<div class="empty-state" style="color:#c0392b;">
            <p>Errore caricamento prodotti: ${sanitize(err.message)}</p>
            <button class="btn-admin btn-ghost btn-sm" onclick="location.reload()">Riprova</button>
          </div>`;
        }
      });
  }

  // ============================================================
  // Modal Prodotto
  // ============================================================
  function openProductModal(product) {
    const overlay   = document.getElementById('product-modal-overlay');
    const titleEl   = document.getElementById('product-modal-title');
    const deleteBtn = document.getElementById('product-delete-btn');

    if (!overlay) return;

    const form = document.getElementById('product-form');
    if (form) form.reset();

    ['p-name', 'p-price', 'p-desc'].forEach(id => {
      const errEl = document.getElementById(id + '-err');
      if (errEl) errEl.textContent = '';
      const el = document.getElementById(id);
      if (el) el.classList.remove('invalid');
    });

    if (product) {
      titleEl.textContent = 'Modifica Prodotto';
      document.getElementById('product-id-field').value = product.id;
      document.getElementById('p-name').value            = product.name || '';
      document.getElementById('p-price').value           = product.price || '';
      document.getElementById('p-desc').value            = product.description || '';
      document.getElementById('p-weight').value          = product.weightG || '';
      document.getElementById('p-stock').value           = (product.stock !== null && product.stock !== undefined) ? product.stock : '';
      document.getElementById('p-available').checked     = product.available !== false;
      setImagePreview(product.imageUrl || null);
      if (deleteBtn) deleteBtn.style.display = '';
    } else {
      titleEl.textContent = 'Aggiungi Prodotto';
      document.getElementById('product-id-field').value = '';
      document.getElementById('p-weight').value          = '';
      document.getElementById('p-stock').value           = '';
      document.getElementById('p-available').checked     = true;
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
    const area      = document.getElementById('img-upload-area');
    const preview   = document.getElementById('p-img-preview');
    const prompt    = document.getElementById('img-upload-prompt');
    const removeBtn = document.getElementById('img-remove-btn');
    const hidden    = document.getElementById('p-imageurl');

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
    const area      = document.getElementById('img-upload-area');
    const fileInput = document.getElementById('p-imageupload');
    const removeBtn = document.getElementById('img-remove-btn');

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
  // Contatore caratteri descrizione
  // ============================================================
  function updateCharCounter() {
    const textarea = document.getElementById('p-desc');
    const counter  = document.getElementById('p-desc-count');
    if (textarea && counter) counter.textContent = textarea.value.length;
  }

  // ============================================================
  // Validazione form prodotto
  // ============================================================
  function validateProductForm() {
    let valid = true;

    const nameEl  = document.getElementById('p-name');
    const nameErr = document.getElementById('p-name-err');
    if (!nameEl.value.trim()) {
      nameEl.classList.add('invalid');
      if (nameErr) nameErr.textContent = 'Nome obbligatorio';
      valid = false;
    } else {
      nameEl.classList.remove('invalid');
      if (nameErr) nameErr.textContent = '';
    }

    const priceEl  = document.getElementById('p-price');
    const priceErr = document.getElementById('p-price-err');
    const price    = parseFloat(priceEl.value);
    if (isNaN(price) || price < 0.5) {
      priceEl.classList.add('invalid');
      if (priceErr) priceErr.textContent = 'Prezzo non valido (min €0.50)';
      valid = false;
    } else {
      priceEl.classList.remove('invalid');
      if (priceErr) priceErr.textContent = '';
    }

    const descEl  = document.getElementById('p-desc');
    const descErr = document.getElementById('p-desc-err');
    if (!descEl.value.trim()) {
      descEl.classList.add('invalid');
      if (descErr) descErr.textContent = 'Descrizione obbligatoria';
      valid = false;
    } else {
      descEl.classList.remove('invalid');
      if (descErr) descErr.textContent = '';
    }

    return valid;
  }

  // ============================================================
  // Salva prodotto (crea o aggiorna)
  // ============================================================
  function handleSaveProduct(formData) {
    const saveBtn = document.querySelector('#product-form [type="submit"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvataggio…'; }

    const op = formData.id
      ? updateProduct(formData.id, formData)
      : createProduct(formData);

    op
      .then(() => {
        closeProductModal();
        loadAndRender();
      })
      .catch(function (err) {
        alert('Errore salvataggio: ' + err.message);
      })
      .finally(function () {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salva'; }
      });
  }

  // ============================================================
  // Elimina prodotto
  // ============================================================
  function handleDeleteProduct(id) {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return;
    deleteProduct(id)
      .then(() => {
        closeProductModal();
        loadAndRender();
      })
      .catch(err => alert('Errore eliminazione: ' + err.message));
  }

  // ============================================================
  // Event listeners modal
  // ============================================================
  function initModalEvents() {
    const overlay   = document.getElementById('product-modal-overlay');
    const closeBtn  = document.getElementById('product-modal-close');
    const cancelBtn = document.getElementById('product-cancel-btn');
    const deleteBtn = document.getElementById('product-delete-btn');
    const form      = document.getElementById('product-form');

    if (closeBtn)  closeBtn.addEventListener('click', closeProductModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeProductModal);

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeProductModal();
      });
    }

    const desc = document.getElementById('p-desc');
    if (desc) desc.addEventListener('input', updateCharCounter);

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        const id = document.getElementById('product-id-field').value;
        if (id) handleDeleteProduct(id);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateProductForm()) return;

        const stockRaw  = document.getElementById('p-stock').value.trim();
        const weightRaw = document.getElementById('p-weight').value.trim();
        handleSaveProduct({
          id:          document.getElementById('product-id-field').value,
          name:        document.getElementById('p-name').value.trim(),
          description: document.getElementById('p-desc').value.trim(),
          price:       parseFloat(document.getElementById('p-price').value),
          weightG:     weightRaw === '' ? null : parseInt(weightRaw, 10),
          stock:       stockRaw === '' ? null : parseInt(stockRaw, 10),
          available:   document.getElementById('p-available').checked,
          imageUrl:    document.getElementById('p-imageurl').value.trim(),
        });
      });
    }

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
      loadAndRender();
    }
  });

}());
