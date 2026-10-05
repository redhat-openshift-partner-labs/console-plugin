import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseAllDocuments, stringify } from 'yaml';

const CHART = 'charts/partner-labs-console-plugin';
const TEMPLATES = 'templates/virt-cookbook';
const IMAGE = 'plugin.image=example.invalid/partner-labs-console-plugin:ci';
type Mapping = Record<string, unknown>;

function check(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new Error(`${path}: ${message}`);
}

function mapping(value: unknown, path: string): Mapping {
  check(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    path,
    'expected a mapping',
  );
  return value as Mapping;
}

function text(value: unknown, path: string, max = Infinity): string {
  check(typeof value === 'string' && value.trim().length > 0, path, 'expected a nonblank string');
  check(Array.from(value).length <= max, path, `must contain at most ${String(max)} characters`);
  return value;
}

function list(value: unknown, path: string): unknown[] {
  check(Array.isArray(value), path, 'expected a list');
  return value as unknown[];
}

function stringFields(value: Mapping, path: string, fields: string[]): void {
  for (const field of fields) text(value[field], `${path}.${field}`);
}

function documents(source: string, path: string) {
  const result = parseAllDocuments(source);
  for (const document of result) {
    check(
      document.errors.length === 0,
      path,
      document.errors.map((error) => error.message).join('\n'),
    );
  }
  return result;
}

export function parseYaml(source: string, path: string): unknown {
  const parsed = documents(source, path);
  check(parsed.length === 1, path, 'expected exactly one YAML document');
  return parsed[0].toJS() as unknown;
}

function validateTask(value: unknown, path: string): void {
  const task = mapping(value, path);
  stringFields(task, path, ['title', 'description']);
  if (task.review !== undefined) {
    const review = mapping(task.review, `${path}.review`);
    stringFields(review, `${path}.review`, ['instructions', 'failedTaskHelp']);
  }
  if (task.summary !== undefined) {
    const summary = mapping(task.summary, `${path}.summary`);
    text(summary.success, `${path}.summary.success`);
    text(summary.failed, `${path}.summary.failed`, 128);
  }
}

// Structural checks follow the OpenShift 4.19 ConsoleQuickStart API, not Markdown execution.
// https://github.com/openshift/api/blob/release-4.19/console/v1/types_console_quick_start.go
export function validateResource(value: unknown, path: string, id: string): Mapping {
  const resource = mapping(value, path);
  check(
    resource.apiVersion === 'console.openshift.io/v1',
    `${path}.apiVersion`,
    'expected console.openshift.io/v1',
  );
  check(resource.kind === 'ConsoleQuickStart', `${path}.kind`, 'expected ConsoleQuickStart');
  const metadata = mapping(resource.metadata, `${path}.metadata`);
  check(metadata.name === id, `${path}.metadata.name`, `expected ${id}`);
  check(
    metadata.namespace === undefined,
    `${path}.metadata.namespace`,
    'must be omitted (cluster scoped)',
  );
  const spec = mapping(resource.spec, `${path}.spec`);
  stringFields(spec, `${path}.spec`, ['displayName', 'introduction']);
  text(spec.description, `${path}.spec.description`, 256);
  check(
    typeof spec.durationMinutes === 'number' &&
      Number.isInteger(spec.durationMinutes) &&
      spec.durationMinutes > 0,
    `${path}.spec.durationMinutes`,
    'expected a positive integer',
  );
  const tasks = list(spec.tasks, `${path}.spec.tasks`);
  check(tasks.length > 0, `${path}.spec.tasks`, 'expected at least one task');
  tasks.forEach((task, index) => {
    validateTask(task, `${path}.spec.tasks[${String(index)}]`);
  });
  for (const field of ['tags', 'prerequisites', 'nextQuickStart']) {
    if (spec[field] !== undefined) {
      list(spec[field], `${path}.spec.${field}`).forEach((item, index) => {
        check(
          typeof item === 'string',
          `${path}.spec.${field}[${String(index)}]`,
          'expected a string',
        );
      });
    }
  }
  for (const field of ['icon', 'conclusion']) {
    if (spec[field] !== undefined)
      check(typeof spec[field] === 'string', `${path}.spec.${field}`, 'expected a string');
  }
  return resource;
}

interface Inventory {
  templates: Map<string, string>;
  defaults: Record<string, boolean>;
}

function matchIds(actual: string[], expected: string[], path: string): void {
  const missing = expected.filter((id) => !actual.includes(id));
  const extra = actual.filter((id) => !expected.includes(id));
  check(
    missing.length === 0 && extra.length === 0,
    path,
    `IDs do not match; missing: [${missing.join(', ')}]; unexpected: [${extra.join(', ')}]`,
  );
}

function cardIds(value: unknown): string[] {
  const seen = new Set<string>();
  const quickStarts: string[] = [];
  list(value, 'src/cards.yaml').forEach((value, index) => {
    const path = `src/cards.yaml[${String(index)}]`;
    const card = mapping(value, path);
    const id = text(card.id, `${path}.id`);
    check(!seen.has(id), `${path}.id`, `duplicate card ID ${id}`);
    seen.add(id);
    if (card.kind === 'quickstart') {
      check(card.quickStartId === id, `${path}.quickStartId`, `expected ${id}`);
      quickStarts.push(id);
    }
  });
  return quickStarts;
}

function readInventory(root: string): Inventory {
  const directory = join(root, CHART, TEMPLATES);
  const files = (
    existsSync(directory) ? readdirSync(directory, { recursive: true, encoding: 'utf8' }) : []
  )
    .filter((file) => /\.ya?ml$/.test(file))
    .sort();
  const templates = new Map<string, string>();
  const ids = new Set<string>();
  for (const file of files) {
    const id = basename(file).replace(/\.ya?ml$/, '');
    check(
      id.split('.').every((part) => /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(part)) &&
        id.length <= 253,
      `${TEMPLATES}/${file}`,
      'expected a DNS resource name',
    );
    check(!ids.has(id), `${TEMPLATES}/${file}`, `duplicate template ID ${id}`);
    ids.add(id);
    templates.set(`${TEMPLATES}/${file}`, id);
  }
  const valuesPath = `${CHART}/values.yaml`;
  const values = mapping(
    parseYaml(readFileSync(join(root, valuesPath), 'utf8'), valuesPath),
    valuesPath,
  );
  const plugin = mapping(values.plugin, `${valuesPath}.plugin`);
  const switches = mapping(plugin.quickStarts, `${valuesPath}.plugin.quickStarts`);
  const defaults: Record<string, boolean> = {};
  for (const [id, value] of Object.entries(switches)) {
    const path = `${valuesPath}.plugin.quickStarts.${id}`;
    const toggle = mapping(value, path);
    check(typeof toggle.enabled === 'boolean', `${path}.enabled`, 'expected a Boolean');
    defaults[id] = toggle.enabled;
  }
  matchIds(Object.keys(defaults), [...ids], `${valuesPath}.plugin.quickStarts`);
  matchIds(
    cardIds(parseYaml(readFileSync(join(root, 'src/cards.yaml'), 'utf8'), 'src/cards.yaml')),
    [...ids],
    'src/cards.yaml quickstart cards',
  );
  return { templates, defaults };
}

function helm(root: string, args: string[], input?: string): string {
  try {
    return execFileSync('helm', args, {
      cwd: root,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `helm ${args.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function render(root: string, overrides?: Record<string, boolean>): string {
  const args = ['template', 'quickstart-validation', CHART, '--set-string', IMAGE];
  if (overrides === undefined) return helm(root, args);
  const quickStarts = Object.fromEntries(
    Object.entries(overrides).map(([id, enabled]) => [id, { enabled }]),
  );
  // A values document keeps dotted names literal and avoids shell/key escaping.
  return helm(root, [...args, '--values', '-'], stringify({ plugin: { quickStarts } }));
}

function renderedResources(
  output: string,
  inventory: Inventory,
  scenario: string,
): Map<string, Mapping> {
  const resources = new Map<string, Mapping>();
  for (const document of documents(output, scenario)) {
    const value: unknown = document.toJS();
    if (value === null) continue;
    const resource = mapping(value, scenario);
    const raw = output.slice(document.range[0], document.range[1]);
    // Helm emits a source comment for every rendered document, including extra documents in a template.
    const source = /^# Source: ([^\r\n]+)$/m.exec(raw)?.[1];
    const template = source?.slice(source.indexOf('/') + 1) ?? '';
    const id = inventory.templates.get(template);
    const path = `${scenario}: ${source ?? 'Helm output'}`;
    if (id === undefined) {
      check(
        resource.kind !== 'ConsoleQuickStart',
        path,
        'QuickStart has no matching virt-cookbook template',
      );
      continue;
    }
    check(!resources.has(id), path, 'expected exactly one resource per template');
    resources.set(id, validateResource(resource, path, id));
  }
  return resources;
}

function validateScenario(
  root: string,
  inventory: Inventory,
  scenario: string,
  overrides?: Record<string, boolean>,
  baseline?: Map<string, Mapping>,
): Map<string, Mapping> {
  const resources = renderedResources(render(root, overrides), inventory, scenario);
  const enabled = overrides ?? inventory.defaults;
  matchIds(
    [...resources.keys()],
    Object.keys(enabled).filter((id) => enabled[id]),
    scenario,
  );
  if (baseline) {
    for (const [id, resource] of resources) {
      check(
        isDeepStrictEqual(resource, baseline.get(id)),
        `${scenario}: ${id}`,
        'resource changed when another QuickStart was disabled',
      );
    }
  }
  return resources;
}

export function validateQuickStarts(root: string): number {
  const inventory = readInventory(root);
  helm(root, ['lint', CHART, '--set-string', IMAGE]);
  const allEnabled = Object.fromEntries(Object.keys(inventory.defaults).map((id) => [id, true]));
  const baseline = validateScenario(root, inventory, 'all enabled', allEnabled);
  validateScenario(root, inventory, 'defaults', undefined, baseline);
  for (const id of Object.keys(allEnabled)) {
    const enabled = { ...allEnabled, [id]: false };
    validateScenario(root, inventory, `disabled ${id}`, enabled, baseline);
  }
  const allDisabled = Object.fromEntries(Object.keys(allEnabled).map((id) => [id, false]));
  validateScenario(root, inventory, 'all disabled', allDisabled, baseline);
  return inventory.templates.size;
}
