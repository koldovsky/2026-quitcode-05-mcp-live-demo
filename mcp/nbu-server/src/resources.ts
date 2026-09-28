import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { getRate, getRates } from './nbu.js';

const json = (uri: URL, data: unknown) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }]
});

async function currencyCodes(prefix = '') {
  const rates = await getRates();
  return rates.map(r => r.cc).filter(cc => cc.startsWith(prefix.toUpperCase()));
}

export function registerResources(server: McpServer) {
  server.registerResource(
    'currencies',
    'nbu://currencies',
    { title: 'Currency list', description: 'Currencies published by NBU (code + name)', mimeType: 'application/json' },
    async uri => json(uri, (await getRates()).map(({ cc, name }) => ({ cc, name })))
  );

  server.registerResource(
    'rates-today',
    'nbu://rates/today',
    { title: 'Today rates', description: 'All NBU official rates for today', mimeType: 'application/json' },
    async uri => json(uri, await getRates())
  );

  server.registerResource(
    'rates-by-date',
    new ResourceTemplate('nbu://rates/{date}', { list: undefined }),
    { title: 'Rates by date', description: 'All NBU rates for a date (YYYY-MM-DD)', mimeType: 'application/json' },
    async (uri, { date }) => json(uri, await getRates(String(date)))
  );

  server.registerResource(
    'rate-by-date-currency',
    new ResourceTemplate('nbu://rates/{date}/{currency}', {
      list: undefined,
      complete: { currency: value => currencyCodes(value) }
    }),
    { title: 'Currency rate by date', description: 'One currency rate for a date (YYYY-MM-DD)', mimeType: 'application/json' },
    async (uri, { date, currency }) => json(uri, await getRate(String(currency), String(date)))
  );
}
