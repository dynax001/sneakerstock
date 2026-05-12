// Fetches fresh sneaker data and writes sneakers.json.
// Default source: Sneaks-API (open source, no key, scrapes Flight Club / StockX / GOAT).
// To swap providers, replace fetchFromSneaksAPI() with another adapter that
// returns the same shape (see SHOE_SHAPE below).

const fs = require('fs');
const path = require('path');
const SneaksAPI = require('sneaks-api');

const COUNT = 20;            // how many shoes to pull
const FETCH_PRICES = true;   // set false to skip per-shoe price calls
const OUTPUT = path.join(__dirname, '..', 'sneakers.json');

const COLORS = {
  Nike:          '#ff5a1f',
  Jordan:        '#e60023',
  Adidas:        '#f5f5f7',
  'New Balance': '#9ca3af',
  Reebok:        '#3b82f6',
  Converse:      '#fbbf24',
  Puma:          '#22c55e',
  Asics:         '#a78bfa'
};

function detectBrand(rawBrand, name = '') {
  const s = ((rawBrand || '') + ' ' + name).toLowerCase();
  if (s.includes('jordan')) return 'Jordan';
  if (s.includes('yeezy') || s.includes('adidas')) return 'Adidas';
  if (s.includes('new balance')) return 'New Balance';
  if (s.includes('reebok')) return 'Reebok';
  if (s.includes('converse')) return 'Converse';
  if (s.includes('puma')) return 'Puma';
  if (s.includes('asics')) return 'Asics';
  return 'Nike';
}

// --- Adapter: Sneaks-API ---
function fetchFromSneaksAPI(count) {
  const sneaks = new SneaksAPI();
  return new Promise((resolve, reject) => {
    sneaks.getMostPopular(count, (err, products) => {
      if (err) return reject(err);
      resolve({ sneaks, products: products || [] });
    });
  });
}

function getPrices(sneaks, styleID) {
  return new Promise(resolve => {
    if (!styleID) return resolve(null);
    sneaks.getProductPrices(styleID, (err, data) => {
      if (err || !data) return resolve(null);
      resolve(data);
    });
  });
}

function pickResale(prices, fallback) {
  if (!prices || !prices.lowestResellPrice) return fallback;
  const values = Object.values(prices.lowestResellPrice).filter(v => typeof v === 'number' && v > 0);
  if (!values.length) return fallback;
  return Math.min(...values);
}

// Target shape consumed by index.html
// SHOE_SHAPE: { id, name, brand, releaseDate, retail, resale, prev, color, upcoming, image }

async function main() {
  console.log(`Fetching ${COUNT} popular sneakers via Sneaks-API...`);
  const { sneaks, products } = await fetchFromSneaksAPI(COUNT);
  if (!products.length) {
    console.error('No products returned. Sneaks-API may be down. Keeping existing sneakers.json.');
    process.exit(0);
  }

  const out = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prices = FETCH_PRICES ? await getPrices(sneaks, p.styleID) : null;

    const retail = Math.max(1, parseInt(p.retailPrice, 10) || 150);
    const resaleEstimate = retail * 1.35;
    const resale = Math.round(pickResale(prices, resaleEstimate));
    const prev = Math.round(resale * (0.92 + Math.random() * 0.16));
    const brand = detectBrand(p.brand, p.shoeName);
    const releaseDate = (p.releaseDate || '').slice(0, 10) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const upcoming = new Date(releaseDate + 'T10:00:00').getTime() > Date.now();
    const image = p.thumbnail || (Array.isArray(p.imageLinks) ? p.imageLinks[0] : '') || '';

    out.push({
      id: i + 1,
      name: p.shoeName || p.name || 'Unknown',
      brand,
      releaseDate,
      retail,
      resale,
      prev,
      color: COLORS[brand] || '#ff5a1f',
      upcoming,
      image
    });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} sneakers -> ${OUTPUT}`);
}

main().catch(err => {
  console.error('Refresh failed:', err.message || err);
  process.exit(1);
});
