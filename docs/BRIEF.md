# Panificio Roccafiorita — Brief Tecnico

## 1. Overview
Panificio artigianale siciliano. Obiettivo: vendita online di prodotti secchi spedibili e prenotazione locale pane fresco. MVP gratuito, predisposto per scalare.

**Tipo sito:** Single Page Application (SPA) — una sola pagina HTML, navigazione tramite anchor link e scroll fluido.

## 2. Stack Tecnologico
- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla (no framework, no build tool)
- **Hosting:** Netlify (deploy da GitHub, dominio gratuito incluso)
- **Pagamenti:** Stripe (test mode) + PayPal JS SDK
- **Form prenotazioni:** Formspree (piano gratuito, 50 invii/mese)
- **Carrello:** localStorage browser
- **Database ordini:** nessuno (MVP) — tutto nelle dashboard Stripe/PayPal/Formspree

## 3. Struttura File
panificio-roccafiorita/
├── index.html
├── css/style.css
├── js/
│   ├── main.js
│   ├── cart.js
│   ├── checkout.js
│   └── config.js (NON committare)
├── assets/images/
└── docs/BRIEF.md

## 4. Design System

### Palette
- --color-bg: #FDFAF4 — sfondo avorio
- --color-surface: #F5EFE0 — card e sezioni alternate
- --color-dark: #1C1009 — testi principali
- --color-espresso: #3D2314 — heading, bordi forti
- --color-gold: #A07830 — accenti, prezzi, CTA
- --color-gold-light: #C9A55A — hover states
- --color-cream: #E8DCC8 — separatori, bordi
- --color-text-muted: #7A6550 — testi secondari

### Tipografia
- Display: Playfair Display
- Body: Lora
- Prezzi/numeri: Cormorant Garamond

Google Fonts import:
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=Cormorant+Garamond:wght@400;500;600&display=swap" rel="stylesheet">

### Stile
- Border radius: 4px card, 2px bottoni
- Ombreggiature calde (seppia, mai grigio freddo)
- Animazioni: fade-in scroll (IntersectionObserver), hover 300ms

## 5. Prodotti

### Biscotti Tradizionali
- Placeholder colore: #C4A882
- Unità: kg | Spedibile: sì | Prezzo: config.js

### Cudduredde
- ⚠️ Nome dialettale siciliano — NON modificare mai
- Placeholder colore: #B8956A
- Unità: kg | Spedibile: sì | Prezzo: config.js

### Pane Duro
- Placeholder colore: #9A7B5C
- Unità: kg | Spedibile: sì | Prezzo: config.js

## 6. config.js
const CONFIG = {
  stripe: { publishableKey: 'pk_test_XXXX', currency: 'eur' },
  paypal: { clientId: 'XXXX', currency: 'EUR' },
  formspree: {
    orderEndpoint: 'https://formspree.io/f/XXXXXXXX',
    reservationEndpoint: 'https://formspree.io/f/YYYYYYYY',
  },
  shipping: { freeThreshold: 60, flatRate: 8 },
  products: [
    { id: 'biscotti', name: 'Biscotti Tradizionali', pricePerKg: 14, minKg: 0.5 },
    { id: 'cudduredde', name: 'Cudduredde', pricePerKg: 16, minKg: 0.5 },
    { id: 'pane-duro', name: 'Pane Duro', pricePerKg: 10, minKg: 0.5 },
  ],
  apiBaseUrl: '',
};

## 7. Vincoli Tecnici
- NO React, Vue, Bootstrap o altri framework
- Stripe.js SOLO da cdn.stripe.com/stripe.js
- config.js = unico file da toccare per prezzi e chiavi
- Tutti i placeholder: commento <!-- TODO: sostituire con ... -->

## 8. Sezioni Pagina
1. Navbar fissa (trasparente → solida dopo 80px scroll, hamburger mobile)
2. Hero 100vh (placeholder colore --color-espresso, 2 CTA, freccia bounce)
3. Prodotti #prodotti (grid 3/2/1 col, card con selettore quantità)
4. Storia #storia (2 colonne: testo + immagine forno)
5. Prenotazione #prenota (SOLO ritiro locale, form → Formspree)
6. Contatti #contatti (indirizzo, tel, email, orari, Google Maps)
7. Footer (logo, link, P.IVA, Privacy/Cookie/Termini, copyright JS)

## 9. Comportamento UI
- scroll-behavior: smooth su html
- Navbar: addEventListener scroll → classe .scrolled dopo 80px
- Carrello sidebar: transform translateX
- Modal checkout: overlay blur, chiudibile ESC + click fuori
- Form: validazione inline (no alert())
- "Aggiungi al carrello": feedback visivo 500ms

## 10. Placeholder da Completare
- Logo → logotipo testuale temporaneo
- Immagine hero → rettangolo --color-espresso
- Immagini prodotti → rettangolo colorato con nome
- Prezzi → in config.js
- Anno fondazione → [ANNO]
- Indirizzo → Via [INDIRIZZO], [CITTÀ] (SI)
- Telefono → +39 000 0000000
- Email → info@panificioroccafiorita.it

## 11. Account da Creare
- stripe.com (test mode)
- paypal.com/it/business
- formspree.io
- github.com
- netlify.com
