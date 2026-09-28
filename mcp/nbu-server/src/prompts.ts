import { completable, type McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const COMMON = ['USD', 'EUR', 'PLN', 'GBP', 'CHF', 'CZK', 'JPY', 'CNY', 'CAD', 'UAH'];
const currency = (desc: string) =>
  completable(z.string().describe(desc), value => COMMON.filter(c => c.startsWith(value.toUpperCase())));

const user = (text: string) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] });

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'currency_report',
    {
      title: 'Currency trend report',
      description: 'Analyze the trend of a currency against UAH over a period',
      argsSchema: z.object({
        currency: currency('Currency code, e.g. USD'),
        days: z.string().optional().describe('Period length in days (default 30)')
      })
    },
    ({ currency, days }) =>
      user(
        `Using the get_rate_history tool, fetch the NBU rate of ${currency} for the last ${days ?? '30'} days ending today. ` +
          'Write a concise report: current rate, min/max/average, total change in %, notable jumps, and overall trend. ' +
          'Include a short table of weekly values.'
      )
  );

  server.registerPrompt(
    'convert_and_explain',
    {
      title: 'Convert and explain',
      description: 'Convert an amount and explain the NBU cross-rate calculation',
      argsSchema: z.object({
        amount: z.string().describe('Amount to convert'),
        from: currency('Source currency'),
        to: currency('Target currency'),
        date: z.string().optional().describe('Date YYYY-MM-DD (default today)')
      })
    },
    ({ amount, from, to, date }) =>
      user(
        `Convert ${amount} ${from} to ${to} at the official NBU rate${date ? ` on ${date}` : ' today'} using convert_currency. ` +
          'Explain step by step how the cross-rate through UAH was computed, showing both UAH rates.'
      )
  );

  server.registerPrompt(
    'daily_digest',
    {
      title: 'Daily currency digest',
      description: 'Summarize how key currencies moved since the previous day',
      argsSchema: z.object({ currencies: z.string().optional().describe('Comma-separated codes (default USD,EUR,PLN,GBP)') })
    },
    ({ currencies }) =>
      user(
        `Use compare_rates for ${currencies ?? 'USD,EUR,PLN,GBP'} (previous day vs today). ` +
          'Produce a short digest: a table with rates, absolute and % change, and 2-3 sentences highlighting the biggest movers.'
      )
  );
}
