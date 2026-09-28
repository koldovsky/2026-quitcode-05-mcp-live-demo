// Invoked by Codex. Stdout is a private credential channel; do not run in a terminal.
const path = require('node:path');

try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
  const key = process.env.CONTEXT7_API_KEY?.trim();
  if (!key || /[\r\n]/.test(key)) {
    throw new Error('Missing or invalid key');
  }
  process.stdout.write(JSON.stringify({ Authorization: 'Bearer ' + key }));
} catch {
  process.stderr.write('Unable to load CONTEXT7_API_KEY from the project .env file.\n');
  process.exitCode = 1;
}
