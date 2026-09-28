import { Product } from '../types/product';

/**
 * Dati strutturati (schema.org) per la home: solo fatti reali e verificabili
 * (nome, immagine, prezzo, disponibilità, URL dell'offerta) - MAI un
 * aggregateRating/review. Il "rating" mostrato sulle card è un punteggio
 * editoriale interno (la Volpe), non una media di recensioni reali: includerlo
 * come AggregateRating violerebbe le linee guida sui dati strutturati di
 * Google (richiedono recensioni genuine) e rischierebbe un'azione manuale.
 */
export function buildItemListJsonLd(products: Product[], limit = 24) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.slice(0, limit).map((p, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: p.title,
        image: p.imageUrl,
        brand: p.brand,
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          url: p.affiliateUrl,
        },
      },
    })),
  };
}
