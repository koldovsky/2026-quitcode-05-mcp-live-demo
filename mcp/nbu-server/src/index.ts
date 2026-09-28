import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';

function createServer() {
  const server = new McpServer(
    { name: 'nbu-currency', version: '1.0.0' },
    { instructions: 'Official National Bank of Ukraine exchange rates. Rates are UAH per 1 unit of currency. Dates are YYYY-MM-DD.' }
  );
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
  return server;
}

serveStdio(createServer);
