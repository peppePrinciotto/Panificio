// admin-auth.js — Autenticazione admin con SHA-256 (SubtleCrypto nativo)
// Sessione via sessionStorage, durata 8 ore. Blocco dopo 3 tentativi falliti.

(function () {
  'use strict';

  // Hash SHA-256 della password admin.
  // ISTRUZIONI: sostituire con l'hash calcolato dalla funzione hashPassword().
  // La password NON deve mai apparire nel codice — solo il suo hash.
  // Password di esempio: "RoccafiorITA2025!" → eseguire hashPassword("RoccafiorITA2025!") in console.
  const ADMIN_HASH = 'HASH_SHA256_DA_SOSTITUIRE';

  const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 ore
  const MAX_ATTEMPTS        = 3;
  const LOCKOUT_DURATION_MS = 60 * 1000; // 60 secondi

  // ============================================================
  // Hashing SHA-256 via SubtleCrypto (nativo, zero librerie)
  // ============================================================
  async function hashPassword(password) {
    const encoder    = new TextEncoder();
    const data       = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ============================================================
  // Gestione sessione
  // ============================================================
  function checkSession() {
    try {
      const raw     = sessionStorage.getItem('admin_session');
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (!session.loggedIn || Date.now() > session.expiresAt) {
        sessionStorage.removeItem('admin_session');
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function createSession(token) {
    // Token salvato anche come stringa diretta per lettura affidabile
    sessionStorage.setItem('admin_token', token || '');
    sessionStorage.setItem('admin_session', JSON.stringify({
      loggedIn:  true,
      expiresAt: Date.now() + SESSION_DURATION_MS,
      token:     token || '',
    }));
  }

  function getToken() {
    // Lettura diretta — più affidabile del JSON parsing
    return sessionStorage.getItem('admin_token') || '';
  }

  function logout() {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_session');
    window.location.href = 'admin.html';
  }

  // ============================================================
  // Gestione tentativi e lockout
  // ============================================================
  function getLockoutState() {
    try {
      const raw = sessionStorage.getItem('admin_lockout');
      return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
    } catch (_) {
      return { attempts: 0, lockedUntil: 0 };
    }
  }

  function saveLockoutState(state) {
    sessionStorage.setItem('admin_lockout', JSON.stringify(state));
  }

  function isLockedOut() {
    const state = getLockoutState();
    return Date.now() < state.lockedUntil;
  }

  function recordFailedAttempt() {
    const state = getLockoutState();
    state.attempts += 1;
    if (state.attempts >= MAX_ATTEMPTS) {
      state.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      state.attempts    = 0;
    }
    saveLockoutState(state);
  }

  function resetLockout() {
    sessionStorage.removeItem('admin_lockout');
  }

  // ============================================================
  // Login
  // ============================================================
  async function login(password) {
    const hash = await hashPassword(password);

    // Se ADMIN_HASH è ancora il placeholder, mostra istruzioni in console
    if (ADMIN_HASH === 'HASH_SHA256_DA_SOSTITUIRE') {
      console.info('[Admin] ─────────────────────────────────────────────────');
      console.info('[Admin] SETUP INIZIALE — hash della password inserita:');
      console.info('[Admin]  ', hash);
      console.info('[Admin] Copia questo valore in:');
      console.info('[Admin]   1. const ADMIN_HASH in admin-auth.js');
      console.info('[Admin]   2. Variabile ADMIN_HASH su Netlify (Environment variables)');
      console.info('[Admin] ─────────────────────────────────────────────────');
    }

    // Verifica sempre lato server chiamando admin-data.js
    try {
      const res = await fetch('/.netlify/functions/admin-data?action=auth-check', {
        method:  'GET',
        headers: { 'Authorization': 'Bearer ' + hash },
      });

      if (res.ok)             return hash; // 200 → password corretta
      if (res.status === 401) return null; // 401 → password sbagliata

      // 500 o altro errore server
      let msg = 'Errore server (' + res.status + ')';
      try { const d = await res.json(); msg = d.error || msg; } catch (_) {}
      console.error('[Admin] Errore verifica:', msg);
      throw new Error(msg);

    } catch (err) {
      // Se è già un errore server esplicitiamo, altrimenti è un errore di rete
      if (err.message && (err.message.includes('Errore server') || err.message.includes('Configurazione'))) {
        throw err;
      }
      // Rete non raggiungibile (sviluppo locale senza Netlify Dev)
      console.warn('[Admin] admin-data.js non raggiungibile:', err.message);
      console.warn('[Admin] Fallback: validazione locale (solo sviluppo)');
      if (ADMIN_HASH !== 'HASH_SHA256_DA_SOSTITUIRE') {
        return hash === ADMIN_HASH ? hash : null;
      }
      throw new Error('Funzione admin non raggiungibile. Avvia Netlify Dev per il testing locale.');
    }
  }

  // ============================================================
  // Inizializzazione UI
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    const loginScreen  = document.getElementById('login-screen');
    const adminLayout  = document.getElementById('admin-layout');
    if (!loginScreen || !adminLayout) return;

    // Mostra il pannello se sessione attiva
    if (checkSession()) {
      showAdmin();
      return;
    }

    // Altrimenti mostra login
    showLogin();
    setupLoginForm();
  });

  function showAdmin() {
    const loginScreen = document.getElementById('login-screen');
    const adminLayout = document.getElementById('admin-layout');
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminLayout) adminLayout.style.display = 'flex';
    setupLogout();
    setupSidebarNav();
    setupSidebarToggle();
    // Triggera init delle sezioni
    document.dispatchEvent(new CustomEvent('admin:ready'));
  }

  function showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const adminLayout = document.getElementById('admin-layout');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (adminLayout) adminLayout.style.display = 'none';

    // Focus automatico sul campo password
    setTimeout(() => {
      const pwdInput = document.getElementById('admin-password');
      if (pwdInput) pwdInput.focus();
    }, 100);
  }

  function setupLoginForm() {
    const form       = document.getElementById('login-form');
    const errEl      = document.getElementById('login-error');
    const lockoutEl  = document.getElementById('login-lockout');
    const countdownEl = document.getElementById('lockout-countdown');
    const loginBtn   = document.getElementById('login-btn');
    if (!form) return;

    // Controlla se attualmente bloccato
    if (isLockedOut()) {
      startCountdown();
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (isLockedOut()) {
        startCountdown();
        return;
      }

      const password = document.getElementById('admin-password').value;
      if (!password) return;

      loginBtn.disabled    = true;
      loginBtn.textContent = 'Verifica…';

      let hashOrNull = null;
      let serverError = null;

      try {
        hashOrNull = await login(password);
      } catch (err) {
        serverError = err.message;
      }

      if (hashOrNull) {
        resetLockout();
        createSession(hashOrNull);
        showAdmin();
      } else {
        if (serverError) {
          // Errore server/rete — non conta come tentativo fallito
          if (errEl) {
            errEl.textContent   = serverError;
            errEl.style.display = 'block';
          }
        } else {
          // Password sbagliata
          recordFailedAttempt();

          if (errEl) {
            errEl.textContent   = 'Credenziali non valide.';
            errEl.style.display = 'block';
          }

          if (isLockedOut()) {
            if (errEl) errEl.style.display = 'none';
            startCountdown();
          }
        }

        document.getElementById('admin-password').value = '';
        loginBtn.disabled    = false;
        loginBtn.textContent = 'Accedi';
      }

      function startCountdown() {
        if (lockoutEl) lockoutEl.style.display = 'block';
        if (loginBtn)  loginBtn.disabled = true;
        if (errEl)     errEl.style.display = 'none';

        const tick = setInterval(function () {
          const state     = getLockoutState();
          const remaining = Math.ceil((state.lockedUntil - Date.now()) / 1000);

          if (remaining <= 0) {
            clearInterval(tick);
            if (lockoutEl)    lockoutEl.style.display = 'none';
            if (loginBtn) {
              loginBtn.disabled    = false;
              loginBtn.textContent = 'Accedi';
            }
          } else {
            if (countdownEl) countdownEl.textContent = remaining;
          }
        }, 1000);
      }
    });
  }

  function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  }

  // ============================================================
  // Navigazione tra sezioni del pannello
  // ============================================================
  function setupSidebarNav() {
    const links = document.querySelectorAll('.sidebar-link[data-section]');
    const topbarTitle = document.getElementById('topbar-title');

    links.forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const section = this.dataset.section;
        navigateTo(section);

        // Chiudi sidebar su mobile
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar && window.innerWidth < 768) {
          sidebar.classList.remove('open');
        }
      });
    });

    // Attiva sezione default
    navigateTo('dashboard');
  }

  function navigateTo(section) {
    // Aggiorna link attivi
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => {
      l.classList.toggle('active', l.dataset.section === section);
    });

    // Mostra/nasconde sezioni
    document.querySelectorAll('.admin-section').forEach(s => {
      s.style.display = 'none';
    });

    const target = document.getElementById(`section-${section}`);
    if (target) target.style.display = '';

    // Aggiorna titolo topbar
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle && target) {
      topbarTitle.textContent = target.dataset.title || section;
    }

    // Triggera evento per la sezione attivata
    document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section } }));
  }

  // ============================================================
  // Toggle sidebar su mobile
  // ============================================================
  function setupSidebarToggle() {
    const btn      = document.getElementById('sidebar-toggle-btn');
    const sidebar  = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!btn || !sidebar) return;

    function openSidebar() {
      sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('active');
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    }

    btn.addEventListener('click', function () {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Chiudi con ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });

    // Chiudi al click su un link della sidebar su mobile
    sidebar.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth < 768) closeSidebar();
      });
    });
  }

  // ============================================================
  // Utility pubblica (usata dagli altri moduli admin)
  // ============================================================
  window.AdminAuth = {
    checkSession,
    logout,
    hashPassword, // esposto per generare l'hash in console
    getToken,     // usato dai moduli admin per le chiamate a admin-data.js
  };

}());
