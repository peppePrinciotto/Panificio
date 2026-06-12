# Panificio Roccafiorita — Documentazione Fase 2
## Admin Panel · Responsività Mobile · Sicurezza
**Versione 1.0 — Da consegnare a Claude Code**

---

## INDICE

1. [Pannello Admin — Panoramica e Architettura](#1-pannello-admin)
2. [Autenticazione Admin](#2-autenticazione-admin)
3. [Struttura file Admin](#3-struttura-file-admin)
4. [Funzionalità Admin — Gestione Prodotti](#4-gestione-prodotti)
5. [Funzionalità Admin — Dashboard Vendite](#5-dashboard-vendite)
6. [Funzionalità Admin — Gestione Prenotazioni](#6-gestione-prenotazioni)
7. [Responsività Mobile](#7-responsività-mobile)
8. [Sicurezza](#8-sicurezza)
9. [Istruzioni dirette per Claude Code](#9-istruzioni-per-claude-code)

---

## 1. PANNELLO ADMIN

### 1.1 Cos'è e a cosa serve

Il pannello admin è un'area protetta da password accessibile solo al titolare del panificio. Da qui può:
- Gestire i prodotti (aggiungere, modificare, nascondere, cambiare prezzi e descrizioni)
- Vedere le statistiche di vendita mensili per prodotto
- Consultare e gestire le prenotazioni di pane fresco
- Aggiornare i testi del sito (storia, orari, contatti) senza toccare il codice

### 1.2 Come accede il titolare — soluzione senza backend

**Problema:** senza un backend custom, come proteggiamo una pagina admin?

**Soluzione MVP (gratuita, senza server):** URL segreto + password lato client con hashing.

Il pannello è accessibile tramite un URL non linkato e non indicizzato:
```
https://panificioroccafiorita.netlify.app/admin.html
```

All'apertura compare una schermata di login con:
- Campo password
- Bottone "Accedi"

La password viene hashata con SHA-256 nel browser e confrontata con un hash hardcoded in `js/admin-auth.js`. Se corrisponde, si accede. La sessione dura 8 ore (via sessionStorage), poi richiede di riloggarsi.

**NOTA IMPORTANTE per Claude Code:** questo sistema è adeguato per un piccolo panificio MVP. Non usare la password in chiaro nel codice — solo l'hash SHA-256. L'hash va inserito nel file `js/admin-auth.js` come costante. La password reale viene comunicata al titolare verbalmente o via messaggio privato, MAI scritta nel codice.

**Come generare l'hash:** Claude Code deve includere una funzione di utility che, dato "RoccafiorITA2025!" (password esempio), restituisce il suo SHA-256. Il titolare potrà in futuro cambiare la password rigenerando l'hash.

```javascript
// Esempio — non usare questa password, è solo illustrativa
// Hash SHA-256 di "RoccafiorITA2025!" = da calcolare e inserire
const ADMIN_HASH = "HASH_SHA256_QUI";
```

**Sicurezza di questo approccio:**
- L'URL non è linkato da nessuna parte del sito pubblico
- Il file è escluso dalla sitemap
- `robots.txt` esclude `/admin.html`
- La password non è nel codice sorgente, solo il suo hash
- La sessione si chiude automaticamente dopo 8 ore
- Limite: se qualcuno scopre l'URL e fa brute force, può in teoria forzarla. Per il momento è accettabile per un MVP.

**Predisposizione futura:** quando si vorrà un sistema più robusto, si potrà sostituire con Netlify Identity (gratuito, con email/password gestiti da Netlify) oppure con Supabase Auth (gratuito). Il codice deve essere strutturato in modo da rendere questa sostituzione semplice.

### 1.3 Design del pannello admin

Il pannello admin ha uno stile separato dal sito pubblico: più funzionale, meno decorativo. Usa lo stesso color system del sito ma con layout a sidebar fissa.

**Palette admin:**
- Sfondo principale: `#F8F6F1` (stesso avorio del sito)
- Sidebar: `#1C1009` (dark espresso)
- Sidebar testo: `#F5EFE0` (crema chiaro)
- Sidebar link attivo: `#A07830` (gold)
- Accent cards: `#A07830`
- Testo: `#1C1009`
- Bordi: `#E8DCC8`
- Success: `#2D7A47`
- Warning: `#C4870A`
- Danger: `#A03020`

**Font:** stessi del sito (Playfair Display per titoli, Lora per testi).

**Layout:**
```
┌─────────────┬──────────────────────────────────────────┐
│             │  TOPBAR: "Benvenuto, Pannello Admin"      │
│  SIDEBAR    │  [Logout]                                 │
│             ├──────────────────────────────────────────┤
│  🏠 Dashboard│                                          │
│  📦 Prodotti │          CONTENUTO PRINCIPALE            │
│  📅 Prenot. │          (cambia in base alla voce        │
│  ✏️ Testi   │           selezionata nella sidebar)      │
│             │                                          │
│  ─────────  │                                          │
│  🔒 Logout  │                                          │
└─────────────┴──────────────────────────────────────────┘
```

---

## 2. AUTENTICAZIONE ADMIN

### File: `js/admin-auth.js`

```javascript
// Struttura da implementare (pseudocodice)

const ADMIN_HASH = "SHA256_HASH_DELLA_PASSWORD";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 ore

async function hashPassword(password) {
  // Usa SubtleCrypto API nativa del browser — nessuna libreria
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(password) {
  const hash = await hashPassword(password);
  if (hash === ADMIN_HASH) {
    sessionStorage.setItem('admin_session', JSON.stringify({
      loggedIn: true,
      expiresAt: Date.now() + SESSION_DURATION_MS
    }));
    return true;
  }
  return false;
}

function checkSession() {
  const session = JSON.parse(sessionStorage.getItem('admin_session') || '{}');
  if (!session.loggedIn || Date.now() > session.expiresAt) {
    sessionStorage.removeItem('admin_session');
    return false;
  }
  return true;
}

function logout() {
  sessionStorage.removeItem('admin_session');
  window.location.href = '/admin.html';
}
```

### Schermata di login

La pagina `admin.html` mostra di default solo la schermata di login. Se la sessione è valida, mostra direttamente il pannello. Layout:

```
┌────────────────────────────────────┐
│                                    │
│    PANIFICIO ROCCAFIORITA          │
│    Accesso Amministratore          │
│                                    │
│    ┌──────────────────────────┐    │
│    │  🔒  Password            │    │
│    └──────────────────────────┘    │
│                                    │
│    [  Accedi  ]                    │
│                                    │
│    ⚠️ "Password errata" (se fail) │
│                                    │
└────────────────────────────────────┘
```

Regole UX login:
- Dopo 3 tentativi falliti: blocco di 60 secondi con countdown visibile
- Nessun hint su "password errata" che riveli informazioni (messaggio generico)
- Enter sul campo password esegue il login
- Focus automatico sul campo password

---

## 3. STRUTTURA FILE ADMIN

Aggiungere alla struttura del progetto:

```
panificio-roccafiorita/
├── admin.html              ← pagina admin (login + pannello)
├── css/
│   ├── style.css           ← (esistente, sito pubblico)
│   └── admin.css           ← stili del pannello admin
├── js/
│   ├── (file esistenti...)
│   ├── admin-auth.js       ← autenticazione
│   ├── admin-products.js   ← gestione prodotti
│   ├── admin-dashboard.js  ← statistiche vendite
│   ├── admin-reservations.js ← gestione prenotazioni
│   └── admin-content.js    ← gestione testi
└── data/
    └── products.json       ← dati prodotti (letti da localStorage in MVP)
```

### Storage dei dati admin (MVP — localStorage)

In mancanza di un database, tutti i dati admin vengono salvati in localStorage con prefisso `roccafiorita_`. Le chiavi usate:

| Chiave localStorage | Contenuto |
|---|---|
| `roccafiorita_products` | Array JSON dei prodotti con prezzi, descrizioni, disponibilità |
| `roccafiorita_sales` | Array JSON degli ordini registrati (da Stripe webhook simulato) |
| `roccafiorita_reservations` | Array JSON delle prenotazioni pane |
| `roccafiorita_content` | Oggetto JSON con testi modificabili (storia, orari, contatti) |

**NOTA:** il sito pubblico (`index.html`) deve leggere i prodotti da `localStorage.getItem('roccafiorita_products')` invece che solo da `config.js`. Se la chiave è vuota, usa i valori di default da `config.js` come fallback. Così le modifiche admin si riflettono immediatamente sul sito.

---

## 4. GESTIONE PRODOTTI

### Sezione "Prodotti" del pannello admin

**Vista lista prodotti:**

```
┌─────────────────────────────────────────────────────────┐
│  PRODOTTI                            [+ Aggiungi Nuovo] │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │ [IMG] Biscotti Tradizionali    14,00 €/kg  ✅ Att. │  │
│  │       "Biscotti artigianali..."         [Mod][Nas]│  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ [IMG] Cudduredde               16,00 €/kg  ✅ Att. │  │
│  │       "Dolce tipico siciliano..." [Mod][Nas]       │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ [IMG] Pane Duro                10,00 €/kg  ⛔ Nasc │  │
│  │       "Pane a lunga..."         [Mod][Rend vis.]   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Modal "Modifica Prodotto" / "Aggiungi Prodotto":**

Campi nel form:
- **Nome prodotto** (testo, obbligatorio)
- **Descrizione breve** (textarea, max 200 caratteri, con contatore)
- **Descrizione lunga** (textarea, opzionale, per futura pagina dettaglio)
- **Prezzo al kg** (number, step 0.50, min 0.50, obbligatorio)
- **Quantità minima ordinabile** (number, step 0.5, default 0.5)
- **Disponibile** (toggle on/off — se off, il prodotto compare sul sito ma con badge "Non disponibile" e bottone disabilitato)
- **URL immagine** (testo — per ora inserisce URL esterno o percorso locale; in futuro upload)
- **Peso spedizione per kg** (number in grammi — per calcolo spedizione futuro)

Bottoni:
- **Salva** — salva in localStorage, aggiorna sito in tempo reale
- **Annulla** — chiude senza salvare
- **Elimina** (solo in modifica, con conferma "Sei sicuro?") — rimuove il prodotto

**Comportamento:** quando il titolare salva un prodotto, `localStorage.setItem('roccafiorita_products', JSON.stringify(products))` aggiorna i dati. Il sito pubblico al prossimo caricamento leggerà i nuovi dati. Non serve refresh del pannello.

**Schema dati prodotto:**
```json
{
  "id": "biscotti",
  "name": "Biscotti Tradizionali",
  "shortDescription": "Biscotti artigianali preparati secondo la ricetta di famiglia...",
  "longDescription": "",
  "pricePerKg": 14.00,
  "minKg": 0.5,
  "available": true,
  "imageUrl": "assets/images/biscotti.jpg",
  "shippingWeightGramsPerKg": 1100,
  "createdAt": "2025-04-01T00:00:00Z",
  "updatedAt": "2025-04-01T00:00:00Z"
}
```

---

## 5. DASHBOARD VENDITE

### Sezione "Dashboard" del pannello admin

Questa è la prima schermata che vede il titolare dopo il login. Mostra un riepilogo chiaro e immediato.

**Layout Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  RIEPILOGO — Aprile 2025                [< Mese] [Mese >]│
├───────────────┬───────────────┬─────────────────────────┤
│ 💰 Incasso    │ 📦 Ordini     │ ⚖️  Kg venduti           │
│ 1.240,00 €    │ 23 ordini     │ 87,5 kg                 │
│ +12% vs marzo │ +5 vs marzo   │ +8% vs marzo            │
├───────────────┴───────────────┴─────────────────────────┤
│  VENDITE PER PRODOTTO — Aprile 2025                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Prodotto          │ Kg venduti │ Incasso  │ Ordini│    │
│  ├────────────────────┼───────────┼──────────┼───────┤    │
│  │ Biscotti          │  38,5 kg  │ 539,00 € │  11   │    │
│  │ Cudduredde        │  31,0 kg  │ 496,00 € │   9   │    │
│  │ Pane Duro         │  18,0 kg  │ 180,00 € │   3   │    │
│  ├────────────────────┼───────────┼──────────┼───────┤    │
│  │ TOTALE            │  87,5 kg  │1.215,00 € │  23  │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  GRAFICO VENDITE — Ultimi 6 mesi                         │
│  [Grafico a barre semplice — canvas HTML5 o SVG]        │
│   Nov  Dic  Gen  Feb  Mar  Apr                           │
├─────────────────────────────────────────────────────────┤
│  ULTIMI ORDINI                              [Vedi tutti] │
│  ┌──────────────────────────────────────────────────┐   │
│  │ #ORD-001 │ Mario Rossi │ 2,5 kg bisc. │ 35,00€ │ ✅ │  │
│  │ #ORD-002 │ Anna Verdi  │ 1 kg cudd.   │ 16,00€ │ ✅ │  │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Navigazione temporale:** bottoni "Mese precedente" e "Mese successivo" filtrano tutti i dati sul mese selezionato. Il mese corrente è il default.

**Grafico:** implementare con Canvas API nativo (nessuna libreria Chart.js o simili — manteniamo zero dipendenze). Il grafico è a barre verticali, una per mese, con hover che mostra il valore esatto.

**Fonte dati vendite (MVP):** gli ordini vengono registrati in `localStorage` quando un pagamento viene completato nel sito pubblico. Al momento del pagamento (successo Stripe/PayPal), `checkout.js` deve chiamare una funzione `recordOrder(orderData)` che salva in `localStorage['roccafiorita_sales']`.

**Schema dati ordine:**
```json
{
  "id": "ORD-20250401-001",
  "date": "2025-04-01T14:32:00Z",
  "customer": {
    "name": "Mario Rossi",
    "email": "mario@email.com",
    "city": "Milano"
  },
  "items": [
    { "productId": "biscotti", "productName": "Biscotti Tradizionali", "kg": 2.5, "pricePerKg": 14.00, "subtotal": 35.00 }
  ],
  "shipping": 0,
  "total": 35.00,
  "paymentMethod": "stripe",
  "paymentId": "pi_XXXXXXXXXX",
  "status": "paid"
}
```

**Esportazione dati:** bottone "Esporta CSV" nella sezione dashboard che scarica un file CSV con tutti gli ordini del mese selezionato. Implementare con `Blob` e `URL.createObjectURL` — nessuna libreria.

---

## 6. GESTIONE PRENOTAZIONI

### Sezione "Prenotazioni" del pannello admin

**Lista prenotazioni:**

```
┌─────────────────────────────────────────────────────────┐
│  PRENOTAZIONI                [Filtro: Tutte ▼] [Oggi]   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📅 05/04 │ Mario Rossi │ 2kg pane + 4 panini │📞 │  ⏳ │
│  │           │ 333-1234567 │ Nota: "senza sale"   │  │   │
│  │           │  [✅ Confermata] [❌ Rifiuta] [🗑️ Elimina]│
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📅 06/04 │ Anna Verdi  │ 1,5kg pane           │📞 │  ✅ │
│  │           │ 347-9876543 │                      │  │   │
│  │           │  [✅ Confermata] [❌ Rifiuta] [🗑️ Elimina]│
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Stati prenotazione:**
- ⏳ In attesa (default)
- ✅ Confermata
- ❌ Rifiutata

**Filtri disponibili:** Tutte / Oggi / Questa settimana / In attesa / Confermate

**Come arrivano le prenotazioni nell'admin:** quando l'utente invia il form prenotazione sul sito pubblico, oltre all'invio Formspree il JavaScript deve salvare la prenotazione anche in `localStorage['roccafiorita_reservations']`. Il pannello admin legge da lì.

**Nota:** questo significa che le prenotazioni sono visibili nell'admin solo se fatte dallo stesso browser/dispositivo. Per un vero sistema multi-dispositivo serve un backend. Comunicarlo chiaramente al titolare e predisporre la sostituzione futura.

---

## 7. SEZIONE "CONTENUTI" — Testi Modificabili

### Sezione "Testi" del pannello admin

Il titolare può modificare i testi del sito senza toccare il codice:

**Campi modificabili:**
- Testo sezione "La Nostra Storia" (textarea WYSIWYG semplice)
- Anno di fondazione del panificio
- Indirizzo completo
- Telefono
- Email di contatto
- Orari di apertura (tabella editabile: giorno → orario)
- Link Google Maps

**UX:** form con bottone "Salva Modifiche". Il sito pubblico legge questi testi da `localStorage['roccafiorita_content']` con fallback ai valori hardcoded in HTML.

---

## 8. RESPONSIVITÀ MOBILE

### 8.1 Breakpoint di riferimento

```css
/* Mobile first */
/* Base styles: mobile (< 480px) */
@media (min-width: 480px)  { /* mobile large */ }
@media (min-width: 768px)  { /* tablet */ }
@media (min-width: 1024px) { /* desktop small */ }
@media (min-width: 1280px) { /* desktop large */ }
```

### 8.2 Navbar mobile — hamburger menu

**Problema riportato:** il bottone hamburger non funziona su mobile.

**Implementazione corretta:**

```html
<!-- Struttura HTML navbar -->
<nav class="navbar">
  <div class="navbar__logo">...</div>
  
  <button class="navbar__hamburger" 
          aria-label="Apri menu" 
          aria-expanded="false"
          aria-controls="navbar-menu">
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
  </button>
  
  <ul class="navbar__menu" id="navbar-menu" role="list">
    <li><a href="#prodotti">Prodotti</a></li>
    <li><a href="#storia">Storia</a></li>
    <li><a href="#prenota">Prenota</a></li>
    <li><a href="#contatti">Contatti</a></li>
    <li class="navbar__cart-item">
      <button class="cart-icon-btn" aria-label="Carrello">...</button>
    </li>
  </ul>
</nav>
```

```css
/* Mobile: menu nascosto di default */
@media (max-width: 767px) {
  .navbar__menu {
    position: fixed;
    top: 0;
    right: -100%;
    width: 80%;
    max-width: 320px;
    height: 100vh;
    background: var(--color-dark);
    flex-direction: column;
    padding: 5rem 2rem 2rem;
    transition: right 0.35s ease;
    z-index: 1000;
    overflow-y: auto;
  }
  
  .navbar__menu.is-open {
    right: 0;
  }
  
  /* Overlay scuro dietro il menu */
  .navbar__overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
  }
  
  .navbar__overlay.is-visible {
    display: block;
  }
  
  .navbar__hamburger {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    z-index: 1001;
  }
  
  .hamburger-line {
    width: 24px;
    height: 2px;
    background: var(--color-dark);
    transition: all 0.3s ease;
    display: block;
  }
  
  /* Animazione X quando aperto */
  .navbar__hamburger[aria-expanded="true"] .hamburger-line:nth-child(1) {
    transform: translateY(7px) rotate(45deg);
  }
  .navbar__hamburger[aria-expanded="true"] .hamburger-line:nth-child(2) {
    opacity: 0;
  }
  .navbar__hamburger[aria-expanded="true"] .hamburger-line:nth-child(3) {
    transform: translateY(-7px) rotate(-45deg);
  }
}

/* Desktop: hamburger nascosto */
@media (min-width: 768px) {
  .navbar__hamburger { display: none; }
  .navbar__menu { display: flex; flex-direction: row; }
}
```

```javascript
// main.js — hamburger logic
const hamburger = document.querySelector('.navbar__hamburger');
const menu = document.querySelector('.navbar__menu');
const overlay = document.querySelector('.navbar__overlay');

function toggleMenu(forceClose = false) {
  const isOpen = menu.classList.contains('is-open') || forceClose;
  
  if (isOpen) {
    menu.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Apri menu');
    document.body.style.overflow = '';
  } else {
    menu.classList.add('is-open');
    overlay.classList.add('is-visible');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Chiudi menu');
    document.body.style.overflow = 'hidden'; // blocca scroll background
  }
}

hamburger.addEventListener('click', () => toggleMenu());
overlay.addEventListener('click', () => toggleMenu(true));

// Chiudi menu quando si clicca un link
menu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => toggleMenu(true));
});

// Chiudi con tasto ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleMenu(true);
});
```

### 8.3 Adattamenti mobile per ogni sezione

**Hero section:**
- Testo headline: 2.5rem mobile → 4rem desktop
- Sottotitolo: 1rem mobile → 1.25rem desktop
- I due CTA diventano colonna su mobile (flex-direction: column)
- Altezza hero: `100svh` (small viewport height — gestisce la barra URL mobile)

**Sezione Prodotti:**
- Grid: 1 colonna mobile → 2 tablet → 3 desktop
- Card: padding ridotto su mobile, immagine più bassa (aspect-ratio: 16/9 invece di 4/3)
- Selettore quantità (+/-): bottoni più grandi su mobile (min 44px × 44px — standard accessibilità touch)
- Bottone "Aggiungi al carrello": full width su mobile

**Carrello sidebar:**
- Mobile: drawer che sale dal basso (bottom sheet) invece che da destra
- Altezza massima: `80vh` con scroll interno
- Chiudersi con swipe verso il basso (touch events)

```javascript
// Bottom sheet swipe-to-close
let startY = 0;
cartDrawer.addEventListener('touchstart', (e) => startY = e.touches[0].clientY, { passive: true });
cartDrawer.addEventListener('touchend', (e) => {
  if (e.changedTouches[0].clientY - startY > 80) closeCart(); // swipe down 80px
}, { passive: true });
```

**Modal checkout:**
- Mobile: full screen (posizione fixed, width 100%, height 100%)
- Scroll interno per il form
- Bottoni Stripe/PayPal: full width, height minima 48px

**Sezione Storia:**
- Layout a due colonne → una colonna su mobile (immagine prima, testo sotto)

**Footer:**
- Tre colonne → una colonna su mobile
- Link più spaziati (min 44px di altezza per target touch)

**Tipografia responsive (fluid typography):**
```css
:root {
  /* Scala fluida: da 16px mobile a 18px desktop */
  font-size: clamp(15px, 1.5vw, 18px);
}

h1 { font-size: clamp(2rem, 5vw, 4rem); }
h2 { font-size: clamp(1.5rem, 3.5vw, 2.5rem); }
h3 { font-size: clamp(1.2rem, 2.5vw, 1.75rem); }
```

### 8.4 Performance mobile

- `loading="lazy"` su tutte le immagini tranne la hero
- Hero image: `<link rel="preload">` nell'`<head>`
- Evitare `backdrop-filter: blur()` su elementi che scorrono (costoso su mobile)
- Usare `will-change: transform` solo su elementi animati, rimuoverlo dopo l'animazione
- Touch events con `{ passive: true }` dove possibile

### 8.5 Viewport e meta tag

```html
<!-- Nell'<head> — già presente ma verificare -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- NON usare maximum-scale=1 — impedisce zoom agli utenti ipovedenti -->
```

---

## 9. SICUREZZA

### 9.1 Content Security Policy (CSP)

Aggiungere in `netlify.toml` (file di configurazione Netlify nella root del progetto):

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com https://fonts.googleapis.com 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; Pagamento con carta non configurato — aggiorna config.js con la tua chiave Stripe connect-src 'self' https://api.stripe.com https://formspree.io https://www.paypal.com; form-action 'self' https://formspree.io;"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"

[[headers]]
  for = "/admin.html"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
    Cache-Control = "no-store, no-cache"
```

**NOTA per Claude Code:** `'unsafe-inline'` è necessario per Stripe Elements e PayPal SDK che iniettano stili inline. In alternativa futura si può usare nonce-based CSP. Per ora lasciare così.

### 9.2 robots.txt

```txt
User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /admin
Disallow: /.claude/
Disallow: /docs/

Sitemap: https://panificioroccafiorita.netlify.app/sitemap.xml
```

### 9.3 Protezione dati form e input

**Sanitizzazione input:**
```javascript
function sanitizeInput(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML; // escaping HTML automatico via DOM API
}

// Applicare a TUTTI gli input prima di mostrarli nel DOM
// (prevenzione XSS)
```

**Validazione lato client (non sostituisce quella server, ma migliora UX):**
```javascript
const validators = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v) => /^[\d\s\+\-\(\)]{8,20}$/.test(v),
  name: (v) => v.trim().length >= 2 && v.trim().length <= 100,
  kg: (v) => !isNaN(v) && parseFloat(v) >= 0.5 && parseFloat(v) <= 50,
  date: (v) => {
    const d = new Date(v);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d >= tomorrow;
  }
};
```

**Anti-spam sul form prenotazioni:**
```javascript
// Honeypot field — campo nascosto, i bot lo compilano, gli umani no
// Aggiungere al form HTML:
// <input type="text" name="website" class="honeypot" tabindex="-1" autocomplete="off">

// CSS:
// .honeypot { position: absolute; left: -9999px; opacity: 0; }

// JS — se compilato, blocca l'invio silenziosamente
if (formData.get('website')) {
  showSuccess(); // finge successo, non invia nulla
  return;
}
```

**Rate limiting lato client (per prenotazioni):**
```javascript
function canSubmitForm(formType) {
  const key = `ratelimit_${formType}`;
  const last = parseInt(localStorage.getItem(key) || '0');
  const now = Date.now();
  if (now - last < 60000) return false; // 1 submission per minuto per tipo
  localStorage.setItem(key, now.toString());
  return true;
}
```

### 9.4 Sicurezza del carrello e prezzi

**PROBLEMA CRITICO da correggere:** il prezzo totale NON deve mai essere calcolato solo lato client senza verifica. In un sistema MVP senza backend, il rischio è che un utente modifichi il prezzo nel localStorage prima del pagamento.

**Soluzione:** 
- I prezzi in `config.js` sono la fonte di verità
- Al momento del checkout, ricalcolare sempre il totale da `config.js` lato client (mai fidarsi dei prezzi salvati nel carrello)
- Il carrello salva solo `{ productId, kg }` — i prezzi vengono sempre riletti da `CONFIG.products`
- Questo non previene attacchi tecnici avanzati (serve un backend per quello), ma previene modifiche accidentali o naïve

```javascript
// SBAGLIATO — salvare il prezzo nel carrello
cart.add({ id: 'biscotti', kg: 1, price: 14 }); // NON fare così

// GIUSTO — salvare solo quantità, ricalcolare sempre
cart.add({ id: 'biscotti', kg: 1 });
// Al checkout:
function calculateTotal(cartItems) {
  return cartItems.reduce((total, item) => {
    const product = CONFIG.products.find(p => p.id === item.id);
    return total + (product.pricePerKg * item.kg);
  }, 0);
}
```

### 9.5 Protezione chiavi API

**Verifica del `.gitignore`:** assicurarsi che questi file NON siano mai committati:
```gitignore
js/config.js
.env
.env.local
.env.*
*.pem
*.key
```

**ATTENZIONE:** Stripe publishable key e PayPal client ID sono pubblici per design — possono stare nel codice. La chiave **segreta** Stripe (`sk_...`) non deve MAI essere nel frontend. Per il MVP non serve la chiave segreta (usiamo solo il frontend SDK).

### 9.6 HTTPS e cookie

- Netlify forza HTTPS automaticamente — nessuna configurazione necessaria
- Non usare `document.cookie` per dati sensibili — usare `sessionStorage` (più sicuro per auth)
- Se si useranno cookie in futuro: attributi obbligatori `Secure; HttpOnly; SameSite=Strict`

### 9.7 Dipendenze esterne — caricamento sicuro

Usare Subresource Integrity (SRI) per le librerie esterne quando possibile:

```html
<!-- Esempio con una CDN che supporta SRI -->
<link rel="stylesheet" 
      href="https://fonts.googleapis.com/css2?family=Playfair+Display..."
      crossorigin="anonymous">

<!-- Stripe: NON aggiungere SRI — Stripe aggiorna il file frequentemente -->
<script src="https://js.stripe.com/v3/" async></script>
```

### 9.8 Cookie banner e GDPR

Il sito usa Stripe e PayPal (terze parti che possono tracciare). È obbligatorio per legge italiana ed europea:

**Implementare un cookie banner minimale:**

```
┌────────────────────────────────────────────────────────────────┐
│ 🍪 Questo sito usa cookie tecnici necessari al funzionamento   │
│ e cookie di terze parti per i pagamenti (Stripe, PayPal).      │
│                                                                │
│ Usare il sito significa accettare i cookie necessari.          │
│ [Accetta e continua]  [Solo necessari]  [Maggiori info]        │
└────────────────────────────────────────────────────────────────┘
```

Il banner deve apparire solo al primo accesso. La scelta va salvata in `localStorage['cookie_consent']`.

**Regola:** Stripe e PayPal possono essere caricati solo dopo il consenso, oppure possono essere caricati subito se classificati come "necessari per il servizio" (il pagamento lo è). Classificarli come necessari semplifica la gestione.

---

## 10. ISTRUZIONI DIRETTE PER CLAUDE CODE

### 10.1 Ordine di sviluppo consigliato

Completare in questo ordine per minimizzare conflitti:

1. **Sicurezza base** — `netlify.toml`, `robots.txt`, CSP headers, sanitizzazione input (non richiede nuovi file)
2. **Responsività mobile** — revisione `style.css`, fix hamburger in `main.js`, adattamenti per ogni sezione
3. **Fix carrello** — correggere la logica dei prezzi (salvare solo quantità, ricalcolare da config)
4. **Pannello admin** — `admin.html`, `admin.css`, `admin-auth.js` (login e sessione)
5. **Admin: Prodotti** — `admin-products.js`, lettura prodotti da localStorage nel sito pubblico
6. **Admin: Dashboard** — `admin-dashboard.js`, grafico canvas, export CSV
7. **Admin: Prenotazioni** — `admin-reservations.js`, modifica `checkout.js` per registrare ordini
8. **Admin: Contenuti** — `admin-content.js`, lettura testi da localStorage nel sito pubblico
9. **Cookie banner** — componente standalone
10. **Test e rifinitura** — test su viewport 375px, 768px, 1280px

### 10.2 Vincoli da rispettare

- Nessuna libreria JavaScript esterna aggiuntiva (zero Chart.js, zero jQuery, zero framework)
- Il grafico vendite: Canvas API nativa
- Il file admin deve essere completamente separato dal sito pubblico (CSS e JS separati)
- La password admin è hashata con SubtleCrypto nativo — nessuna libreria di hashing
- `netlify.toml` deve essere nella root del progetto

### 10.3 Come collegare sito pubblico e admin tramite localStorage

**Nel sito pubblico (`index.html`):**
```javascript
// All'avvio, caricare prodotti da localStorage (se esistono) o da config
function loadProducts() {
  const stored = localStorage.getItem('roccafiorita_products');
  return stored ? JSON.parse(stored) : CONFIG.products;
}

// Al completamento pagamento, registrare l'ordine
function recordOrder(orderData) {
  const orders = JSON.parse(localStorage.getItem('roccafiorita_sales') || '[]');
  orders.push(orderData);
  localStorage.setItem('roccafiorita_sales', JSON.stringify(orders));
}
```

**Nel pannello admin:**
```javascript
// Leggere e scrivere prodotti
function getProducts() {
  return JSON.parse(localStorage.getItem('roccafiorita_products') || JSON.stringify(DEFAULT_PRODUCTS));
}

function saveProducts(products) {
  localStorage.setItem('roccafiorita_products', JSON.stringify(products));
}
```

### 10.4 Comunicazioni importanti per il titolare

Aggiungere in `admin.html` una sezione "Info" che spieghi:
- Come accedere all'admin (URL, password)
- Che le prenotazioni e i dati sono visibili solo dal browser usato per gestire il sito
- Link alle dashboard Stripe e PayPal per gli ordini reali
- Come esportare il CSV delle vendite

### 10.5 Checklist sicurezza da verificare prima del deploy

- [ ] `js/config.js` è in `.gitignore`
- [ ] `netlify.toml` con headers CSP è nella root
- [ ] `robots.txt` esclude `/admin.html`
- [ ] Nessuna password o chiave segreta nel codice committato
- [ ] Tutti gli input vengono sanitizzati prima dell'uso nel DOM
- [ ] Il carrello salva solo ID e quantità, non prezzi
- [ ] L'hash della password admin è calcolato e inserito in `admin-auth.js`
- [ ] Cookie banner presente e funzionante
- [ ] Meta tag `noindex` su `admin.html`

---

## APPENDICE — Struttura file finale del progetto

```
panificio-roccafiorita/
├── index.html
├── admin.html                  ← NUOVO
├── netlify.toml                ← NUOVO
├── robots.txt                  ← NUOVO/AGGIORNARE
├── sitemap.xml
├── .gitignore                  ← AGGIORNARE (aggiungere config.js)
├── css/
│   ├── style.css               ← AGGIORNARE (mobile responsive)
│   └── admin.css               ← NUOVO
├── js/
│   ├── config.js               ← AGGIORNARE (non committare)
│   ├── main.js                 ← AGGIORNARE (hamburger fix, sanitize)
│   ├── cart.js                 ← AGGIORNARE (solo ID+kg, no prezzi)
│   ├── checkout.js             ← AGGIORNARE (recordOrder, ricalcolo prezzi)
│   ├── admin-auth.js           ← NUOVO
│   ├── admin-products.js       ← NUOVO
│   ├── admin-dashboard.js      ← NUOVO
│   ├── admin-reservations.js   ← NUOVO
│   └── admin-content.js        ← NUOVO
└── assets/
    └── images/
```

---

*Fine documento — Panificio Roccafiorita, Fase 2 — v1.0*
