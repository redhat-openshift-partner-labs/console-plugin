import { fileURLToPath } from 'node:url';
import { validateQuickStarts } from './quickstarts.ts';

try {
  const count = validateQuickStarts(fileURLToPath(new URL('../', import.meta.url)));
  console.log(`Validated ${String(count)} virt-cookbook QuickStarts and their Helm switches.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
