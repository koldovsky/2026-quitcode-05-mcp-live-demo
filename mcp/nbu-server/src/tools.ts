import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { addDays, getHistory, getRate, getRates } from './nbu.js';

const dateArg = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date YYYY-MM-DD (default: today, Kyiv time)');
const currencyArg = z.string().length(3).describe('ISO 4217 code, e.g. USD, EUR, UAH');
const rateSchema = z.object({ cc: z.string(), name: z.string(), rate: z.number(), date: z.string() });

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function ok<T extends Record<string, unknown>>(data: T) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

function fail(err: unknown) {
  return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

export function registerTools(server: McpServer) {
  server.registerTool(
    'get_exchange_rates',
    {
      title: 'NBU exchange rates',
      description: 'Official NBU exchange rates (UAH per 1 unit) for a date, optionally filtered by currencies',
      inputSchema: z.object({ date: dateArg, currencies: z.array(z.string()).optional().describe('Filter, e.g. ["USD","EUR"]') }),
      outputSchema: z.object({ date: z.string(), rates: z.array(rateSchema) })
    },
    async ({ date, currencies }) => {
      try {
        let rates = await getRates(date);
        if (currencies?.length) {
          const wanted = new Set(currencies.map(c => c.toUpperCase()));
          rates = rates.filter(r => wanted.has(r.cc));
        }
        return ok({ date: rates[0]?.date ?? date ?? '', rates });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    'get_exchange_rate',
    {
      title: 'NBU rate for one currency',
      description: 'Official NBU rate of one currency in UAH for a date',
      inputSchema: z.object({ currency: currencyArg, date: dateArg }),
      outputSchema: rateSchema
    },
    async ({ currency, date }) => {
      try {
        return ok({ ...(await getRate(currency, date)) });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    'convert_currency',
    {
      title: 'Convert currency',
      description: 'Convert an amount between currencies (incl. UAH) using NBU cross-rates via UAH',
      inputSchema: z.object({ amount: z.number(), from: currencyArg, to: currencyArg, date: dateArg }),
      outputSchema: z.object({
        amount: z.number(),
        from: z.string(),
        to: z.string(),
        result: z.number(),
        crossRate: z.number(),
        date: z.string()
      })
    },
    async ({ amount, from, to, date }) => {
      try {
        const [a, b] = await Promise.all([getRate(from, date), getRate(to, date)]);
        const crossRate = a.rate / b.rate;
        const rateDate = a.cc === 'UAH' ? b.date : a.date;
        return ok({ amount, from: a.cc, to: b.cc, result: round(amount * crossRate, 2), crossRate: round(crossRate, 6), date: rateDate });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    'get_rate_history',
    {
      title: 'Rate history',
      description: 'Daily NBU rate series for a currency over a period (max 366 days) with statistics',
      inputSchema: z.object({
        currency: currencyArg,
        start: z.string().describe('Start date YYYY-MM-DD'),
        end: z.string().describe('End date YYYY-MM-DD')
      }),
      outputSchema: z.object({
        currency: z.string(),
        stats: z.object({ min: z.number(), max: z.number(), avg: z.number(), first: z.number(), last: z.number(), changePct: z.number() }),
        series: z.array(z.object({ date: z.string(), rate: z.number() }))
      })
    },
    async ({ currency, start, end }) => {
      try {
        if (Date.parse(end) - Date.parse(start) > 366 * 86_400_000) throw new Error('Period too long (max 366 days)');
        const history = await getHistory(currency, start, end);
        const values = history.map(h => h.rate);
        const first = values[0]!;
        const last = values.at(-1)!;
        return ok({
          currency: currency.toUpperCase(),
          stats: {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: round(values.reduce((s, v) => s + v, 0) / values.length),
            first,
            last,
            changePct: round(((last - first) / first) * 100, 3)
          },
          series: history.map(h => ({ date: h.date, rate: h.rate }))
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    'compare_rates',
    {
      title: 'Compare rates between dates',
      description: 'Compare NBU rates of currencies between two dates (default: previous day vs today)',
      inputSchema: z.object({ currencies: z.array(z.string()).min(1), date1: dateArg, date2: dateArg }),
      outputSchema: z.object({
        date1: z.string(),
        date2: z.string(),
        items: z.array(z.object({ cc: z.string(), rate1: z.number(), rate2: z.number(), delta: z.number(), deltaPct: z.number() }))
      })
    },
    async ({ currencies, date1, date2 }) => {
      try {
        const d2 = date2 ?? (await getRates())[0]!.date;
        const d1 = date1 ?? addDays(d2, -1);
        const items = await Promise.all(
          currencies.map(async c => {
            const [a, b] = await Promise.all([getRate(c, d1), getRate(c, d2)]);
            return {
              cc: a.cc,
              rate1: a.rate,
              rate2: b.rate,
              delta: round(b.rate - a.rate),
              deltaPct: round(((b.rate - a.rate) / a.rate) * 100, 3)
            };
          })
        );
        return ok({ date1: d1, date2: d2, items });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
