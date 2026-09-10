import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = process.env.PORT || 8787;
app.use(cors());
app.use(express.json());

const schemes = [
  { name: 'Micro Finance Scheme', ceiling: 140000, loanCap: 125000, rate: 6.5, years: 3, moratorium: 3, label: 'Micro finance' },
  { name: 'Term Loan Scheme', ceiling: 5000000, loanCap: 4500000, rate: 8, years: 7, moratorium: 6, label: 'Term loan' }
];

function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value); }
function finance(margin) {
  const projectCost = margin * 10;
  const scheme = schemes.find((item, index) => index === 0 ? projectCost <= item.ceiling : projectCost <= item.ceiling);
  if (!scheme) return { projectCost, eligible: false };
  const loan = Math.min(projectCost * .9, scheme.loanCap);
  const monthlyRate = scheme.rate / 1200;
  const months = scheme.years * 12;
  const emi = loan * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  return { projectCost, loan, scheme, emi, quarterly: emi * 3, eligible: true };
}

function locationCandidates(location) {
  const cleaned = location.trim().replace(/\s+/g, ' ');
  const titleCased = cleaned.replace(/\b\w/g, character => character.toUpperCase());
  const localitySuffixes = ['nagar', 'pur', 'pura', 'ganj', 'wadi', 'pally', 'palli', 'pet', 'khed', 'gaon', 'gram', 'para', 'bazar', 'bazaar', 'vihar'];
  const splitSuffix = (value) => value.replace(new RegExp(`([a-z])(${localitySuffixes.join('|')})(?=,|\\s|$)`, 'gi'), '$1 $2');
  return [...new Set([cleaned, titleCased, splitSuffix(cleaned), splitSuffix(titleCased)])].filter(Boolean);
}

async function locationSignals(location) {
  const headers = { 'User-Agent': 'SaathiRuralAdvisor/0.1 (public data prototype)' };
  try {
    let place = [];
    for (const candidate of locationCandidates(location)) {
      place = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(candidate)}`, { headers }).then(r => r.json());
      if (place[0]) break;
    }
    if (!place[0]) return { source: ['Location entered by user'], place: location };
    const { lat, lon, display_name: displayName } = place[0];
    const query = `[out:json][timeout:12];(nwr[shop](around:7000,${lat},${lon});nwr[amenity=marketplace](around:7000,${lat},${lon});nwr[amenity=bank](around:7000,${lat},${lon}););out center tags;`;
    const osm = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: `data=${encodeURIComponent(query)}` }).then(r => r.json());
    const elements = osm.elements || [];
    return {
      place: displayName, coordinates: [Number(lat), Number(lon)],
      shops: elements.filter(x => x.tags?.shop).length,
      markets: elements.filter(x => x.tags?.amenity === 'marketplace').length,
      banks: elements.filter(x => x.tags?.amenity === 'bank').length,
      source: ['OpenStreetMap / Nominatim', 'OpenStreetMap / Overpass']
    };
  } catch { return { source: ['Location entered by user'], place: location }; }
}

function demoAdvice({ business, problems, location, financial, signals }) {
  const reach = signals.shops ? `${signals.shops} mapped shops and ${signals.markets || 0} market points within an approximate 7 km search radius` : 'a 5–10 km village and block catchment';
  const placeName = location.split(',')[0];
  const locationSeed = [...location.toLowerCase()].reduce((total, character) => total + character.charCodeAt(0), 0);
  const mappedShops = signals.shops ?? 0;
  const mappedMarkets = signals.markets ?? 0;
  const mappedBanks = signals.banks ?? 0;
  const localAngle = mappedShops >= 25
    ? `${placeName} has ${mappedShops} mapped shops in the search area, so avoid a standard copy of an existing outlet. Compete through a narrow specialist offer, dependable timing, or a bundle local shops do not maintain.`
    : mappedShops > 0
      ? `${placeName} has ${mappedShops} mapped shops and ${mappedMarkets} market points nearby. Test a route that reaches hamlets or customer groups beyond those mapped retail points before taking a permanent storefront.`
      : [
          `${placeName} has limited mapped retail data, which is a signal to validate on foot: identify the nearest existing seller and the travel cost households currently accept.`,
          `${placeName} has limited mapped commerce coverage, so begin with a mobile or order-based pilot through SHGs, local institutions, and weekly market days.`,
          `${placeName} has limited mapped local supply, so interview households across two nearby hamlets to find the service or item they leave the area to buy.`
        ][locationSeed % 3];
  const accessAngle = mappedBanks
    ? ` With ${mappedBanks} mapped bank access point${mappedBanks === 1 ? '' : 's'}, plan digital payments and a separate account for business cash flow from day one.`
    : ' Plan a cash-collection and deposit routine before committing to credit-heavy sales.';
  const profiles = {
    'Dairy & value-added milk': { opportunity: 'Test early-morning milk collection, curd, paneer, and small family-size packs with tea stalls, homes, and sweet shops. A cold-chain or same-day delivery promise is the clearest differentiator.', risks: 'Milk spoilage and inconsistent collection volumes: start with products that can move within the same day and confirm refrigeration costs.', action: 'Ask 15 tea stalls, sweet shops, and households which dairy product runs out first and record daily quantities.' },
    'Retail & essential goods': { opportunity: 'Focus on high-frequency essentials that force households to travel outside the village: affordable staples, hygiene products, and recharge or bill-payment support. Win on reliable stock, not a broad catalogue.', risks: 'Slow-moving stock ties up working capital: use small opening quantities and reorder only after weekly sales evidence.', action: 'List the 20 items villagers currently travel to buy, then compare their weekly price and availability at three nearby shops.' },
    'Food processing': { opportunity: 'Create shelf-stable, locally recognisable products such as spices, pickles, flour mixes, or seasonal fruit products. Start with two products and target haats, kirana stores, and local events.', risks: 'Raw-material seasonality and packaging compliance can erode margins: cost every ingredient, pouch, label, and return before setting a price.', action: 'Run a 30-unit tasting batch with two pack sizes and collect willingness-to-pay from buyers before buying equipment.' },
    'Textiles & tailoring': { opportunity: 'Combine alteration, school-uniform repair, blouse stitching, and seasonal festival orders. Quick turnaround and home measurement visits can matter more than competing on price.', risks: 'Demand clusters around school and festival seasons: balance custom orders with repairs and basic ready-to-sell items.', action: 'Speak with two schools, three cloth shops, and 15 households about uniform, alteration, and festival-order demand.' },
    'Agri-inputs & services': { opportunity: 'Build around crop-calendar needs: seedling support, soil-test coordination, equipment booking, or last-mile input delivery. Trusted guidance and timely availability are stronger than holding every input.', risks: 'Crop cycles create sharp demand peaks and credit risk: avoid informal credit until cash collections are stable.', action: 'Map the top three crops, sowing dates, and the inputs or services farmers travel furthest to access.' },
    'Repair & local services': { opportunity: 'Offer dependable repair for phones, pumps, appliances, or farm equipment, plus pickup and return for nearby hamlets. Service history and transparent rates build repeat business.', risks: 'Parts availability and warranty disputes can damage trust: use written job cards and source common parts from two suppliers.', action: 'Track 25 recent repair needs in the area: device type, travel distance, turnaround time, and amount paid.' }
  };
  const profile = profiles[business] || profiles['Retail & essential goods'];
  const focus = problems.length ? ` Because you selected ${problems.join(', ').toLowerCase()}, prioritise that during your first field check.` : '';
  return {
    summary: `${business} can be tested as a small, repeat-purchase business around ${location}. Start with a narrow offer and validate weekly demand before committing the entire loan amount.${focus}`,
    market: `Initial market reach: ${reach}. Prioritise weekly haats, local retailers, SHG networks, and WhatsApp ordering where available.`,
    opportunity: `${profile.opportunity} ${localAngle}${accessAngle}`,
    risks: [profile.risks, 'Supplier delays: qualify at least two suppliers before taking a large order.', 'Single-buyer risk: keep direct retail and institutional channels separate.'],
    swot: { strengths: `Concessional finance and a defined ${money(financial.projectCost)} project ceiling.`, weaknesses: 'First-time demand estimates may be inaccurate.', opportunities: `${profile.opportunity} ${localAngle}`, threats: profile.risks },
    actions: [profile.action, 'Reserve working capital before purchasing fixed assets.', 'Document monthly sales, stock, and repayment capacity from day one.'],
    generatedBy: 'Planning preview'
  };
}

app.post('/api/advice', async (req, res) => {
  const { location, margin, business, problems = [] } = req.body;
  if (!location || !margin || !business) return res.status(400).json({ error: 'Location, margin capital, and business category are required.' });
  const financial = finance(Number(margin));
  if (!financial.eligible) return res.json({ financial, signals: { place: location, source: ['Location entered by user'] }, schemes, advice: { summary: 'The calculated project cost exceeds the configured scheme ceiling. Please contact the State Channelizing Agency for the relevant higher-value scheme.', generatedBy: 'Calculator' } });
  const signals = await locationSignals(location);
  const context = { location: signals.place || location, business, problems, financial, signals };
  let advice = demoAdvice(context);
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY') {
    try {
      const prompt = `You are Saathi, a careful rural Indian micro-enterprise adviser. Return valid JSON only with keys summary, market, opportunity, risks (array of 3), swot (strengths, weaknesses, opportunities, threats), actions (array of 3). Do not claim unavailable facts. Give practical, locally appropriate advice and state uncertainty. The opportunity must explicitly refer to the resolved location and live local signals (shops, market points, banks). It must differ for a changed location even when the business category remains the same. The opportunity, risks, and actions must be specific to the business category and the selected user problems; do not use generic retail advice. Context: ${JSON.stringify(context)}`;
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(`Gemini API returned HTTP ${response.status}`);
      const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) throw new Error('Gemini API returned no answer');
      advice = { ...JSON.parse(raw), generatedBy: 'Gemini' };
    } catch (error) { advice = { ...advice, generatedBy: `Planning preview (${error.message})` }; }
  }
  res.json({ financial, signals, schemes, advice });
});

function fallbackAdvisor(question, context) {
  const { business, location, financial, signals } = context;
  const lowerQuestion = question.toLowerCase();
  const locationLabel = signals?.place || location;
  const shopContext = signals?.shops ? `${signals.shops} mapped shops nearby` : 'the local catchment';
  if (/profit|margin|earn|revenue/.test(lowerQuestion)) {
    return `For ${business} in ${locationLabel}, improve profit before expanding sales: track contribution per unit after materials, transport, spoilage, and credit losses; keep the best-margin products visible; and raise average order value with a relevant add-on. With ${shopContext}, test one differentiated offer for two weeks, then keep only the version that produces repeat orders. Protect working capital from the ${money(financial?.loan || 0)} indicative loan rather than spending it all on fixed assets.`;
  }
  if (/price|pricing|charge/.test(lowerQuestion)) {
    return `Set a floor price from the full delivered cost, including wastage and your own time, then compare it with three local alternatives around ${locationLabel}. Offer a basic and premium option rather than one discount-heavy price. Review prices weekly for the first month and do not extend credit without recording it.`;
  }
  if (/market|customer|sale|sell/.test(lowerQuestion)) {
    return `Start with a small customer list around ${locationLabel}: households, local retailers, institutions, and weekly-market buyers. Ask each group what they buy now, how often, and why they travel elsewhere. Use the first 20 conversations to select one channel, one offer, and one repeat-purchase habit to test.`;
  }
  return `For ${business} around ${locationLabel}, use the feasibility report as a starting point, then answer this with a short field test: what would change if you tested the idea for 14 days with a small budget? Track sales, repeat buyers, costs, and uncollected credit. Ask a follow-up about pricing, profit, suppliers, competition, or your next step for a more specific answer.`;
}

app.post('/api/advisor', async (req, res) => {
  const { question, context } = req.body;
  if (!question?.trim() || !context?.business || !context?.financial) return res.status(400).json({ error: 'Generate a feasibility report before using the AI Adviser.' });
  let answer = fallbackAdvisor(question, context);
  let generatedBy = 'Planning preview';
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY') {
    try {
      const prompt = `You are Saathi, a careful rural Indian micro-enterprise adviser. Answer the entrepreneur's question directly, in clear practical language. Use the report context. Do not invent local facts, promise loan approval, or make unsupported legal, regulatory, or financial claims. State a small field test or decision criterion where appropriate. Limit your answer to 170 words. Context: ${JSON.stringify(context)}. Question: ${question}`;
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const body = await response.json();
      if (!response.ok) throw new Error(`Gemini API returned HTTP ${response.status}`);
      const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) throw new Error('Gemini API returned no answer');
      answer = raw.trim();
      generatedBy = 'Gemini';
    } catch (error) { generatedBy = `Planning preview (${error.message})`; }
  }
  res.json({ answer, generatedBy });
});

app.listen(port, () => console.log(`Saathi API listening on http://localhost:${port}`));
