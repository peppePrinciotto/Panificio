# Panificio Roccafiorita — Progetto Web

## Stack
- HTML5 + CSS3 + JavaScript vanilla (NO framework, NO build tool)
- File statici puri, deploy su Netlify
- Nessuna dipendenza npm nel progetto finale

## Struttura file
- index.html — pagina unica
- css/style.css — tutti gli stili
- js/main.js — UI e scroll
- js/cart.js — carrello (localStorage)
- js/checkout.js — Stripe + PayPal
- js/config.js — tutte le chiavi e prezzi (NON committare)
- assets/images/ — immagini

## Regole fondamentali
- NON usare React, Vue, Bootstrap o altri framework/librerie CSS
- Caricare Stripe.js SOLO da cdn.stripe.com/stripe.js (requisito sicurezza)
- Tutti i valori configurabili (prezzi, chiavi API, testi) vanno in config.js
- Commentare i placeholder con <!-- TODO: sostituire con ... -->
- Codice leggibile e commentato

## Prodotti
- Biscotti Tradizionali (al kg, spedibile)
- Cudduredde (al kg, spedibile — nome dialettale siciliano, NON modificare)
- Pane Duro (al kg, spedibile)

## Specifiche complete
Vedi: docs/BRIEF.md