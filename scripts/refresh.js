// Fetches sneaker release data from Sneaker News RSS feed and writes sneakers.json.
// No npm dependencies — uses Node 18+ built-in fetch.
// Resale prices are estimated (retail * multiplier) until RapidAPI adapter is added.

const fs = require('fs');
const path = require('path');

const RSS_URL = 'https://sneakernews.com/category/release-dates/feed/';
const COUNT = 20;
const OUTPUT = path.join(__dirname, '..', 'sneakers.json');

const BRAND_COLORS = {
  Nike:          '#ff5a1f',
  Jordan:        '#e60023',
  Adidas:        '#f5f5f7',
  'New Balance': '#9ca3af',
  Reebok:        '#3b82f6',
  Converse:      '#fbbf24',
  Puma:          '#22c55e',
  Asics:         '#a78bfa'
};

const RETAIL_ESTIMATES = {
  Nike: 150, Jordan: 190, Adidas: 140, 'New Balance': 130,
  Reebok: 110, Converse: 85, Puma: 110, Asics: 120
};

function detectBrand(text) {
  const s = (text || '').toLowerCase();
  if (s.includes('jordan') || s.includes('air jordan')) return 'Jordan';
  if (s.includes('yeezy') || s.includes('adidas'))      return 'Adidas';
  if (s.includes('new balance'))                         return 'New Balance';
  if (s.includes('reebok'))                              return 'Reebok';
  if (s.includes('converse') || s.includes('chuck'))    return 'Converse';
  if (s.includes('puma'))                                return 'Puma';
  if (s.includes('asics') || s.includes('gel-'))        return 'Asics';
  return 'Nike';
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
    || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`, 'i'));
  return m ? m[1].trim() : '';
}

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    items.push(m[1]);
  }
  return items;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

function extractImage(itemXml) {
  // Try media:content first, then enclosure, then og:image in content
  return (
    extractAttr(itemXml, 'media:content', 'url') ||
    extractAttr(itemXml, 'enclosure', 'url') ||
    (() => {
      const m = itemXml.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i);
      return m ? m[0] : '';
    })()
  );
}

async function fetchRSS() {
  const res = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'SneakerStock-Bot/1.0' }
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  console.log(`Fetching RSS from ${RSS_URL}...`);
  const xml = await fetchRSS();

  const items = parseItems(xml).slice(0, COUNT);
  if (!items.length) {
    console.error('No items found in RSS feed. Keeping existing sneakers.json.');
    process.exit(0);
  }

  console.log(`Parsed ${items.length} items from feed.`);

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name    = extractTag(item, 'title') || 'Unknown';
    const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'dc:date');
    const image   = extractImage(item);

    const brand       = detectBrand(name);
    const retail      = RETAIL_ESTIMATES[brand] || 150;
    const resale      = Math.round(retail * (1.3 + Math.random() * 0.3));
    const prev        = Math.round(resale * (0.92 + Math.random() * 0.16));
    const releaseDate = parseDate(pubDate) || new Date(Date.now() + (i + 1) * 3 * 86400000).toISOString().slice(0, 10);
    const upcoming    = new Date(releaseDate + 'T10:00:00').getTime() > Date.now();

    out.push({
      id: i + 1,
      name,
      brand,
      releaseDate,
      retail,
      resale,
      prev,
      color: BRAND_COLORS[brand] || '#ff5a1f',
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
