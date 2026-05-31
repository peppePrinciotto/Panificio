// config.js — Unico file da modificare per prezzi, chiavi API e impostazioni
// NON committare questo file con chiavi reali

const CONFIG = {
  stripe: {
    publishableKey: 'pk_test_51TWeFnV05HePTgIH4U2mvaXnbbj5GVUIddVa1lcZS4GE96s1PnMJfzPI6j38cEDczfa4heYtuuzIyl0MheCDRqx400DujiqFWm', // TODO: sostituire con chiave reale da stripe.com
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
  supabase: {
  url: 'https://oyzlsznibhjnpejzkncw.supabase.co',
  anonKey: 'sb_publishable_mFdj3EWrHCCahwpagxXc5Q_cjJlT7ZK',
  },
  shipping: {
    freeThreshold: 60,  // spedizione gratuita sopra questa cifra (€)
    flatRate: 8,        // costo spedizione flat (€)
  },
  products: [
    {
      id: 'cudduredde',
      name: 'Cudduredde', // ⚠️ Nome dialettale siciliano — NON modificare mai
      description: 'Dolci tipici siciliani dalla forma tradizionale, preparati per le festività con amore e ingredienti del territorio.',
      price: 3.60,
      weight_g: 500,
      available: true,
      imageUrl: 'images/cuddureddi.jpg',
    },
    {
      id: 'pane-duro',
      name: 'Caserecci',
      description: 'Pane duro siciliano a lunga conservazione, ideale per accompagnare formaggi e salumi locali o da gustare con olio extravergine.',
      price: 3.60,
      weight_g: 500,
      available: true,
      imageUrl: 'images/caserecci.jpg',
    },
  ],
  apiBaseUrl: '',
};
