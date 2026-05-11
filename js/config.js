// config.js — Unico file da modificare per prezzi, chiavi API e impostazioni
// NON committare questo file con chiavi reali

const CONFIG = {
  stripe: {
    publishableKey: 'pk_test_XXXX', // TODO: sostituire con chiave reale da stripe.com
    currency: 'eur',
  },
  paypal: {
    clientId: 'XXXX', // TODO: sostituire con client ID reale da paypal.com/it/business
    currency: 'EUR',
  },
  formspree: {
    orderEndpoint: 'https://formspree.io/f/XXXXXXXX',       // TODO: sostituire con endpoint reale
    reservationEndpoint: 'https://formspree.io/f/YYYYYYYY', // TODO: sostituire con endpoint reale
  },
  shipping: {
    freeThreshold: 60,  // spedizione gratuita sopra questa cifra (€)
    flatRate: 8,        // costo spedizione flat (€)
  },
  products: [
    {
      id: 'cudduredde',
      name: 'Cudduredde', // ⚠️ Nome dialettale siciliano — NON modificare mai
      weight: '500g',
      pricePerKg: 3.60,
      minKg: 1,
      unit: 'cad.',
      placeholderColor: '#B8956A',
      imageUrl: 'images/cuddureddi.jpg',
      description: 'Dolci tipici siciliani dalla forma tradizionale, preparati per le festività con amore e ingredienti del territorio.',
    },
    {
      id: 'pane-duro',
      name: 'Caserecci',
      weight: '500g',
      pricePerKg: 3.60,
      minKg: 1,
      unit: 'cad.',
      placeholderColor: '#9A7B5C',
      imageUrl: 'images/caserecci.jpg',
      description: 'Pane duro siciliano a lunga conservazione, ideale per accompagnare formaggi e salumi locali o da gustare con olio extravergine.',
    },
  ],
  apiBaseUrl: '',
};
