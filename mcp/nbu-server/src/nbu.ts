const BASE = 'https://bank.gov.ua';

export interface Rate {
  cc: string;
  name: string;
  rate: number;
  date: string; // ISO YYYY-MM-DD
}

interface RawDaily { r030: number; txt: string; rate: number; cc: string; exchangedate: string }
interface RawRange { cc: string; txt: string; rate_per_unit: number; exchangedate: string }

/** Today's date in Kyiv as YYYY-MM-DD. */
export function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const toNbu = (iso: string) => iso.replaceAll('-', '');
const fromNbu = (ddmmyyyy: string) => ddmmyyyy.split('.').reverse().join('-');

export function assertDate(iso: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso))) {
    throw new Error(`Invalid date "${iso}", expected YYYY-MM-DD`);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NBU API ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

const cache = new Map<string, Rate[]>();

/** All official rates for a date (UAH per 1 unit of currency). */
export async function getRates(date = today()): Promise<Rate[]> {
  assertDate(date);
  const cached = cache.get(date);
  if (cached) return cached;
  const raw = await getJson<RawDaily[]>(`${BASE}/NBUStatService/v1/statdirectory/exchange?date=${toNbu(date)}&json`);
  if (!raw.length) throw new Error(`NBU has no rates for ${date} (future date?)`);
  const rates = raw.map(r => ({ cc: r.cc, name: r.txt, rate: r.rate, date: fromNbu(r.exchangedate) }));
  cache.set(date, rates);
  return rates;
}

export async function getRate(currency: string, date = today()): Promise<Rate> {
  const cc = currency.toUpperCase();
  if (cc === 'UAH') return { cc, name: 'Українська гривня', rate: 1, date };
  const rates = await getRates(date);
  const found = rates.find(r => r.cc === cc);
  if (!found) throw new Error(`Unknown currency "${currency}". Known: ${rates.map(r => r.cc).join(', ')}`);
  return found;
}

export async function getHistory(currency: string, start: string, end: string): Promise<Rate[]> {
  assertDate(start);
  assertDate(end);
  if (start > end) throw new Error('start must be <= end');
  const raw = await getJson<RawRange[]>(
    `${BASE}/NBU_Exchange/exchange_site?start=${toNbu(start)}&end=${toNbu(end)}&valcode=${currency.toLowerCase()}&sort=exchangedate&order=asc&json`
  );
  if (!raw.length) throw new Error(`No history for ${currency} between ${start} and ${end}`);
  return raw.map(r => ({ cc: r.cc, name: r.txt, rate: r.rate_per_unit, date: fromNbu(r.exchangedate) }));
}
