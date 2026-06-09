#!/usr/bin/env node
/*
 * OurVoiceVote — daily news generator
 * ------------------------------------
 * Produces news.json: a strictly non-partisan daily digest of national /
 * current-administration news plus a top headline for as many U.S. states /
 * DC as can be verified that day.
 *
 * - Zero npm dependencies. Requires Node 20+ (built-in global fetch).
 * - Calls the Anthropic Messages API with the server-side web search tool,
 *   so a single request researches and returns the digest.
 * - On ANY failure (API error, bad JSON, failed validation) it exits non-zero
 *   WITHOUT writing news.json, so the last good file is preserved.
 *
 * Env:
 *   ANTHROPIC_API_KEY  (required)  — your Anthropic API key
 *   ANTHROPIC_MODEL    (optional)  — defaults to claude-opus-4-8.
 *                                    Set to claude-haiku-4-5 or
 *                                    claude-sonnet-4-6 to lower cost.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'news.json');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

if (!API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

const VALID_CODES = new Set(STATES.map((s) => s[0]));
const stateList = STATES.map((s) => `${s[0]} = ${s[1]}`).join('; ');

const now = new Date();
const label = now.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
});

const SYSTEM = [
  'You are a strictly non-partisan news editor for OurVoiceVote, a free, non-partisan civic-education website.',
  'Your job is to compile a factual daily news digest. Hard rules you must never break:',
  '1. NON-PARTISAN: report only what verifiably happened. Never say whether something is good, bad, right, or wrong. No loaded adjectives, no characterization of parties, officials, or motives, no opinion or framing that favors any side.',
  '2. SOURCED: every item must include a real source publication name and a real article URL that you actually found via web search. Never invent, guess, or approximate a URL.',
  '3. RECENT: include only items from roughly the last 10 days.',
  '4. NO COPYRIGHT: write your own one-sentence neutral summary (max ~30 words). Do not copy article text.',
  '5. BALANCE: across the national digest, cover developments involving all sides; do not over-represent any one party or viewpoint.',
  'Prefer wire services (AP, Reuters), official .gov sources, public broadcasters, and established newspapers of record.',
].join('\n');

const USER = `Today is ${label}. Using web search, compile OurVoiceVote's daily news digest and respond with ONE JSON object and NOTHING ELSE (no markdown, no code fences, no commentary before or after).

The JSON must have exactly this shape:
{
  "national": [
    { "category": "<one of the categories below>", "items": [ { "title": "...", "summary": "...", "details": "...", "source": "...", "url": "https://...", "date": "YYYY-MM-DD" } ] }
  ],
  "states": {
    "<2-letter code>": [ { "title": "...", "summary": "...", "details": "...", "source": "...", "url": "https://...", "date": "YYYY-MM-DD" } ]
  },
  "disclaimer": "<one short non-partisan disclaimer sentence>"
}

NATIONAL: provide these five categories in this order, each with 2-4 items:
- "Administration & Executive Actions" (executive orders, White House announcements, federal agency actions by the current administration)
- "Foreign Policy & National Security" (wars, military actions, international deals/treaties, sanctions, diplomacy)
- "Congress & Legislation" (major bills, votes, funding)
- "Courts & Legal" (Supreme Court and major federal rulings, significant lawsuits)
- "Elections & Voting" (2026 midterms, voting laws, redistricting)

STATES: include an entry ONLY for states/DC where you can verify a genuine recent state-level political or civic news item (governor/legislature actions, new laws or bills, elections/voting, redistricting, major state court rulings). At most 1 item per state. Omit states with nothing verifiable — do not pad. Use these exact 2-letter codes: ${stateList}.

Aim to cover as many states as you can verify. Every item must have a working source URL you found via search. The "details" field is a neutral 2-3 sentence expansion of the story (max ~60 words) shown when a reader clicks "Summarize" — keep it strictly factual, with no opinion. Output ONLY the JSON object.`;

function extractJson(text) {
  if (!text) throw new Error('empty response text');
  let t = text.trim();
  // strip ```json ... ``` fences if present
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object found');
  return JSON.parse(t.slice(start, end + 1));
}

function validItem(it) {
  return it && typeof it.title === 'string' && it.title.trim() &&
    typeof it.url === 'string' && /^https?:\/\//i.test(it.url) &&
    typeof it.source === 'string' && it.source.trim();
}

function validate(d) {
  if (!d || typeof d !== 'object') throw new Error('not an object');
  if (!Array.isArray(d.national)) throw new Error('national missing/not array');

  const national = d.national
    .filter((c) => c && typeof c.category === 'string' && Array.isArray(c.items))
    .map((c) => ({ category: c.category, items: c.items.filter(validItem) }))
    .filter((c) => c.items.length);

  const totalNational = national.reduce((n, c) => n + c.items.length, 0);
  if (totalNational < 3) throw new Error(`too few valid national items (${totalNational})`);

  const states = {};
  if (d.states && typeof d.states === 'object') {
    for (const [code, items] of Object.entries(d.states)) {
      const cc = code.toUpperCase();
      if (!VALID_CODES.has(cc) || !Array.isArray(items)) continue;
      const good = items.filter(validItem).slice(0, 2);
      if (good.length) states[cc] = good;
    }
  }

  return {
    updated: now.toISOString(),
    updatedLabel: label,
    national,
    states,
    disclaimer: typeof d.disclaimer === 'string' && d.disclaimer.trim()
      ? d.disclaimer.trim()
      : 'These headlines are gathered from reputable news organizations and official sources and presented factually, without partisan commentary. Each item links to its original source. OurVoiceVote is non-partisan and does not endorse any party, candidate, or position. Refreshed automatically each day at 9:00 AM Central.',
  };
}

async function main() {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 25 }],
      messages: [{ role: 'user', content: USER }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = extractJson(text);
  const clean = validate(parsed);

  writeFileSync(OUT, JSON.stringify(clean, null, 2) + '\n');
  const stateCount = Object.keys(clean.states).length;
  const natCount = clean.national.reduce((n, c) => n + c.items.length, 0);
  console.log(`Wrote ${OUT} — ${natCount} national items across ${clean.national.length} categories, ${stateCount} states.`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  console.error('news.json was NOT modified; the previous version is preserved.');
  process.exit(1);
});
