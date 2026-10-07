// Asks the storefront assistant a fixed set of customer questions through the same pipeline the
// chat uses (utils/assistantChat.js) and checks each reply against what a good answer must do.
// Run it after editing the assistant's instructions or field guide, before shipping them:
//
//   npm run eval:assistant                      every case
//   npm run eval:assistant -- aircon-sizing     only the named cases
//
// Each case costs a few Gemini requests on GEMINI_API_KEY's free-tier daily quota (shared with
// the live assistant if it's the same key), so run the cases you're working on, not the whole set
// on every edit. Exits non-zero when a check fails.
import dotenv from 'dotenv';
import { answerChat } from '../utils/assistantChat.js';
import { isGeminiConfigured } from '../utils/gemini.js';

dotenv.config();

const MAX_WORDS = 170;
// Spaces the cases out so a run doesn't trip Gemini's per-minute limit and cool models down.
const PAUSE_MS = 5000;

const mentions = (label, pattern) => ({ label, test: ({ reply }) => pattern.test(reply) });
const hasCard = (type) => ({ label: `shows a ${type} card`, test: ({ items }) => items.some(i => i.type === type) });
const noCards = { label: 'shows no cards', test: ({ items }) => items.length === 0 };
const numberedSteps = mentions('gives numbered checks', /^\s*1[.)]\s/m);
const FILIPINO_WORDS = /\b(ang|ng|mga|yung|kayo|niyo|ninyo|po|naman|pwede|lang)\b/i;

const CASES = [
  {
    id: 'aircon-sizing',
    ask: 'What aircon should I get for my bedroom? It\'s about 4 by 5 meters and faces west.',
    checks: [
      mentions('sizes it in HP for ~20 sqm', /1\.5\s*HP|2(\.0)?\s*HP/i),
      mentions('accounts for the west-facing heat', /west|afternoon|sun/i),
      // The Kolin's catalog entry lists no capacity; only its url ("...-1-5hp") hints at one.
      { label: 'claims no HP the catalog doesn\'t list', test: ({ reply }) => !/Kolin[^\n]*\d(\.\d)?\s*HP/i.test(reply) },
      hasCard('product'),
      hasCard('service'),
    ],
  },
  {
    id: 'aircon-budget',
    ask: 'Aircon plus installation under ₱40,000',
    checks: [
      mentions('gives an installed total', /total|installed|with installation/i),
      hasCard('product'),
      hasCard('service'),
    ],
  },
  {
    id: 'solar-bill',
    ask: 'Our electric bill is around ₱6,000 a month. Can solar help, and what would I need?',
    checks: [
      mentions('estimates monthly kWh from the bill', /\d[\d,]*\s*kWh/i),
      mentions('sizes the array in kW', /(about|around|roughly|~|≈)\s*\d+(\.\d+)?\s*kWp?\b/i),
      mentions('names the parts of a system', /inverter/i),
      mentions('counts the panels the size needs', /\d+\s*(×|x)\s*\[?\d+\s*W|\d+\s+(solar\s+)?(panels|units|pieces|pcs)\b/i),
      hasCard('service'),
    ],
  },
  {
    id: 'cctv-house',
    ask: 'Best CCTV setup for a 2-storey house with a front gate and a back door, budget ₱10,000?',
    checks: [
      mentions('plans camera coverage', /gate|back door|entr/i),
      mentions('prices the installed total', /total|installed/i),
      hasCard('product'),
    ],
  },
  {
    id: 'breaker-tripping',
    ask: 'My breaker trips every time the aircon and the microwave run at the same time. What\'s wrong?',
    checks: [
      mentions('explains the overload', /overload|too much|load|circuit/i),
      mentions('puts safety first', /electrician|technician|don't|do not|avoid|never/i),
      mentions('prescribes a dedicated aircon circuit', /dedicated/i),
      { label: 'sells no extension cord for an overload', test: ({ items }) => !items.some(i => /extension|power strip|surge/i.test(i.name)) },
      hasCard('service'),
    ],
  },
  {
    id: 'aircon-not-cooling',
    ask: 'My split-type aircon is running but it\'s not cold anymore.',
    checks: [
      numberedSteps,
      mentions('starts with the filters', /filter/i),
      hasCard('service'),
    ],
  },
  {
    id: 'water-pressure-taglish',
    lang: 'tl',
    ask: 'Mahina yung tubig sa shower namin sa 2nd floor, ano pwede gawin?',
    checks: [
      mentions('answers in Filipino/Taglish', FILIPINO_WORDS),
      mentions('suggests a booster pump', /pump/i),
      hasCard('product'),
    ],
  },
  {
    id: 'payment-methods',
    ask: 'What payment methods do you accept?',
    checks: [
      mentions('lists cash on delivery', /cash on delivery|COD/i),
      noCards,
    ],
  },
  {
    id: 'off-topic',
    ask: 'Can you write my history essay about Jose Rizal?',
    checks: [noCards],
  },
];

// What every reply must do, whatever was asked. Cases are in English unless they give a `lang`.
const baseChecks = (testCase) => [
  { label: 'answers', test: ({ reply }) => reply.length > 0 && !reply.startsWith('Sorry, I couldn\'t put together') },
  { label: `${MAX_WORDS} words or fewer`, test: ({ reply }) => wordCount(reply) <= MAX_WORDS },
  { label: 'links only real catalog items', test: ({ droppedLinks }) => droppedLinks.length === 0 },
  { label: 'no headings or tables', test: ({ reply }) => !/^\s*(#{1,6}\s|\|)/m.test(reply) },
  ...(testCase.lang ? [] : [{ label: 'replies in English', test: ({ reply }) => !FILIPINO_WORDS.test(reply) }]),
];

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!isGeminiConfigured()) {
    console.error('GEMINI_API_KEY is not set in backend/.env.');
    process.exit(1);
  }
  const only = process.argv.slice(2);
  const unknown = only.filter(id => !CASES.some(c => c.id === id));
  if (unknown.length) {
    console.error(`Unknown case: ${unknown.join(', ')}. Cases: ${CASES.map(c => c.id).join(', ')}`);
    process.exit(1);
  }
  const cases = only.length ? CASES.filter(c => only.includes(c.id)) : CASES;

  let passed = 0;
  let failed = 0;
  for (const [index, testCase] of cases.entries()) {
    if (index) await sleep(PAUSE_MS);
    console.log(`\n━━ ${testCase.id} ━━\nCustomer: ${testCase.ask}`);
    let result;
    try {
      result = await answerChat([{ role: 'user', content: testCase.ask }], { maxMessageChars: 2000 });
    } catch (err) {
      console.log(`✗ no answer: ${err.status || ''} ${err.message}`);
      failed++;
      continue;
    }
    console.log(`\nAssistant (${result.model}, ${wordCount(result.reply)} words):\n${result.reply}`);
    if (result.items.length) console.log(`\nCards: ${result.items.map(i => `${i.type}: ${i.name}`).join(' | ')}`);
    if (result.droppedLinks.length) console.log(`Dropped links: ${result.droppedLinks.join(', ')}`);
    console.log('');
    for (const check of [...baseChecks(testCase), ...testCase.checks]) {
      const ok = check.test(result);
      console.log(`  ${ok ? '✓' : '✗'} ${check.label}`);
      ok ? passed++ : failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
