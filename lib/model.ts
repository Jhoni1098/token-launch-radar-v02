// The token radar's model, momentum-1: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every other
// pre-token protocol the house's own rule would keep: the early rows the radar exists to find. A
// protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// Momentum-1 prices a launch on where the money is moving, not on how big the protocol already is:
//
//   ratio(cat) = the category's own market-cap-to-TVL ratio, read off the protocols that already
//                trade: the median mcap_usd / tvl_usd of the category's live protocols, shrunk
//                toward the whole snapshot's median when the category has few live peers.
//                Each live ratio is first winsorized at RATIO_CAP, so one token whose market cap
//                dwarfs its TVL cannot set a category's price, and a category needs at least
//                RATIO_MIN_N live peers before its own median is used at all: below that the
//                snapshot's global median applies.
//   base       = tvl_usd x ratio(cat)
//   growth     = clamp(change_7d, -40, 100) per cent; a single week cannot be trusted past that band,
//                so one protocol's +4,448% week is read as +100% and nothing more.
//   momentum   = (1 + growth / 100) ^ MOMENTUM_POWER, with MOMENTUM_POWER 3: growth compounds, so a
//                protocol growing +18% in a week is priced 1.64x its base, one at +100% is priced 8x,
//                and one shrinking -20% is priced 0.51x. A momentum radar that only nudged the price
//                would crown the same giants as a size radar; the compounding is what lets a rocket
//                outrank a giant standing still.
//   hot        = 1.15 when growth is +10% or better in the week (the top few per cent of the
//                snapshot), else 1.0: a hot streak is worth more than a warm one.
//   fresh      = 1.10 when the protocol has run under a year with no token, else 1.0: young and
//                growing is the earliest a launch can be.
//   chains     = 1 + 0.05 x min(chains - 1, 4)            (reach across chains, capped)
//   size       = clamp((SIZE_REF / tvl_usd) ^ SIZE_EXP, SIZE_MIN, SIZE_MAX), with SIZE_REF $100M and
//                SIZE_EXP 0.5: a momentum-adjusted value, not a raw launch value. A $2.7B protocol is
//                discounted to 0.19x and a $48M protocol is lifted to 1.45x, so the board ranks where
//                the money is moving per dollar already there, not where it already sits. Without it
//                the giants would hold the top ten whatever they grew, and the radar would be a size
//                table in a different colour.
//   implied    = max(1, round(base x momentum x hot x fresh x chains x size))
//
// A $2.7B protocol shrinking -2% a week is worth less per TVL dollar than a $190M protocol growing
// +18%: the snapshot itself says so, because the growth is read off its own change_7d at run time.
// The same function scores every row and no protocol name is ever special-cased.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  momentum_power: number;
  growth_floor: number;
  growth_cap: number;
  hot_threshold: number;
  hot_multiplier: number;
  fresh_days: number;
  fresh_multiplier: number;
  size_ref: number;
  size_exp: number;
  size_min: number;
  size_max: number;
  chain_step: number;
  chain_cap: number;
  ratio_shrink: number;
  ratio_cap: number;
  ratio_min_n: number;
}

export const MODEL: ModelConstants = {
  momentum_power: 3,
  growth_floor: -40,
  growth_cap: 100,
  hot_threshold: 10,
  hot_multiplier: 1.15,
  fresh_days: 365,
  fresh_multiplier: 1.1,
  size_ref: 100_000_000,
  size_exp: 0.5,
  size_min: 0.25,
  size_max: 2.5,
  chain_step: 0.05,
  chain_cap: 4,
  ratio_shrink: 5,
  ratio_cap: 3,
  ratio_min_n: 3,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'momentum-1';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many of the fastest growers the movers strip carries. */
export const MOVERS_ROWS = 5;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    ratio: number;
    growth_pct: number;
    momentum_multiplier: number;
    hot_multiplier: number;
    fresh_multiplier: number;
    size_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, carrying the board's own farm plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  ratio: number;
  growth_pct: number;
  momentum_multiplier: number;
  size_multiplier: number;
  hot: boolean;
  fresh: boolean;
  farm_steps: string[];
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One of the fastest growers, for the movers strip. */
export interface MoverRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  change_7d: number;
  implied_value_usd: number;
}

/** Everything the dashboard needs: the board, the live set, the movers and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_ratio: number;
  rows: RadarRow[];
  live: LiveRow[];
  movers: MoverRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The market-cap-to-TVL ratio each category trades at, read off the snapshot's own live protocols,
 * plus the whole snapshot's median as the fallback. Each live ratio is winsorized at RATIO_CAP first,
 * so one token whose market cap dwarfs its TVL cannot set a category's price. A category's own median
 * is used only when at least RATIO_MIN_N of its protocols already trade; below that the category takes
 * the global median. The used median is shrunk toward the global median by RATIO_SHRINK
 * pseudo-observations, and the result is capped at RATIO_CAP.
 */
export function categoryRatios(snapshot: Snapshot, model: ModelConstants): { byCategory: Map<string, number>; global: number } {
  const live = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== null,
  );
  const winsorized = (r: number): number => Math.min(r, model.ratio_cap);
  const all = live.map((p) => winsorized(p.mcap_usd! / p.tvl_usd));
  const global = all.length > 0 ? median(all) : 0.25;
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const list = byCat.get(p.category!) ?? [];
    list.push(winsorized(p.mcap_usd! / p.tvl_usd));
    byCat.set(p.category!, list);
  }
  const byCategory = new Map<string, number>();
  for (const [cat, ratios] of byCat) {
    if (ratios.length < model.ratio_min_n) continue;
    const catMedian = median(ratios);
    const shrunk = (ratios.length * catMedian + model.ratio_shrink * global) / (ratios.length + model.ratio_shrink);
    byCategory.set(cat, Math.min(shrunk, model.ratio_cap));
  }
  return { byCategory, global };
}

/** The ratio a protocol's category trades at, or the global median when its category has no live peer. */
export function ratioFor(p: SnapshotProtocol, ratios: { byCategory: Map<string, number>; global: number }): number {
  if (p.category !== null) {
    const r = ratios.byCategory.get(p.category);
    if (r !== undefined) return r;
  }
  return ratios.global;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  ratios: { byCategory: Map<string, number>; global: number },
): { implied: number; ratio: number; growthPct: number; momentumMult: number; hotMult: number; freshMult: number; sizeMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const ratio = ratioFor(protocol, ratios);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const momentumMult = (1 + growthPct / 100) ** model.momentum_power;
  const hotMult = growthPct >= model.hot_threshold ? model.hot_multiplier : 1;
  const freshMult = age !== null && age < model.fresh_days ? model.fresh_multiplier : 1;
  const sizeMult = Math.min(model.size_max, Math.max(model.size_min, (model.size_ref / protocol.tvl_usd) ** model.size_exp));
  const chainMult = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const base = protocol.tvl_usd * ratio;
  const implied = Math.max(1, Math.round(base * momentumMult * hotMult * freshMult * sizeMult * chainMult));
  return { implied, ratio, growthPct, momentumMult, hotMult, freshMult, sizeMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the house's watchlist rule keeps off the list: bridges, liquid staking and exchanges. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names the house's rule keeps off the list when a protocol's name begins with one. */
const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a wrapped, staked or bridged product of one whose token already trades. */
export function isDerivative(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (VERSIONED.test(p.name)) return true;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return true;
  if (EXCHANGE_NAMES.some((e) => p.name.startsWith(e))) return true;
  return false;
}

/** Whether a protocol is one the board may rank: pre-token and not a derivative of a trading token. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isDerivative(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const ratios = categoryRatios(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, at any TVL. Never a replacement for a
  // watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, ratios);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      ratio: round4(s.ratio),
      growth_pct: s.growthPct,
      momentum_multiplier: round4(s.momentumMult),
      hot_multiplier: s.hotMult,
      fresh_multiplier: s.freshMult,
      size_multiplier: round4(s.sizeMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, s.growthPct).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the borrow position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trad')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa') || c.includes('real world')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('launchpad') || c.includes('launch')) return `Stake $${capital} of USDC in ${name}'s launch pool on ${chain} and join one sale.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s private pool on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is timed to
 * momentum: enter while the growth is hot, add only while it stays hot, and leave the moment the
 * weekly growth turns cold twice in a row. It is derived from the protocol's own record (category,
 * chains, TVL, age, seven-day growth), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, growthPct: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const action = actionFor(p, capital, chain);
  const hot = growthPct >= MODEL.hot_threshold;
  const cold = growthPct < 0;
  // The step's words quote the week's actual growth, not the model's clamped read of it.
  const shownGrowth = p.change_7d ?? growthPct;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: hot
        ? `Enter now while the momentum is hot: ${p.name} grew ${shownGrowth.toFixed(1)}% in the last 7 days, so open the position this week. ${action}`
        : cold
          ? `Wait for the turn: ${p.name} fell ${Math.abs(shownGrowth).toFixed(1)}% in the last 7 days, so watch one more week and enter only when the weekly change turns positive. ${action}`
          : `Enter this week while the growth is flat to positive: ${action}`,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Split the entry: put in half the capital now and the other half next week, but only if the 7-day growth is still positive when the second week comes.`,
      cost: `$${Math.round(capital / 2)} of capital now and $${Math.round(capital / 2)} next week`,
      time: '10 minutes a week',
    },
    {
      text: `Check the 7-day growth every week: add a little more only while it stays above +5%, and stop adding the week it falls below zero.`,
      cost: 'no fee to check',
      time: '10 minutes a week',
    },
    {
      text: `Ride the hot streak, then leave on the signal: if the 7-day growth is negative two weeks in a row, unwind the position and rotate the capital to the next hot protocol on this board.`,
      cost: 'gas only to unwind',
      time: '15 minutes to unwind',
    },
    {
      text: `Open the protocol's own points or rewards page once a week and check that your wallet shows the activity.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes a week',
    },
    {
      text: `Before you withdraw, claim only from the link the protocol itself publishes, and check the contract address first.`,
      cost: 'gas only, and never pay a claim fee',
      time: '10 minutes',
    },
  ];
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The fastest growers on the board, for the movers strip. */
export function moverRows(board: BoardRow[]): MoverRow[] {
  return [...board]
    .filter((r) => r.change_7d !== null && r.change_7d > 0)
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0))
    .slice(0, MOVERS_ROWS)
    .map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d!,
      implied_value_usd: r.implied_value_usd,
    }));
}

/** A board row's compact form for data.js, carrying the board's own farm plan. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    ratio: row.model.ratio,
    growth_pct: row.model.growth_pct,
    momentum_multiplier: row.model.momentum_multiplier,
    size_multiplier: row.model.size_multiplier,
    hot: row.model.hot_multiplier > 1,
    fresh: row.model.fresh_multiplier > 1,
    farm_steps: row.farm_steps,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const ratios = categoryRatios(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const wl = new Set(snapshot.watchlist);
  const early = board.filter((r) => !wl.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_ratio: round4(ratios.global),
    rows: board.map((r) => radarRow(r, wl)),
    live,
    movers: moverRows(board),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
