/** @jest-environment node */
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';
import { parseYaml, validateQuickStarts, validateResource } from './quickstarts.ts';

const chartPath = 'charts/partner-labs-console-plugin';
const templatePath = `${chartPath}/templates/virt-cookbook`;

function resource(id = 'alpha') {
  return {
    apiVersion: 'console.openshift.io/v1',
    kind: 'ConsoleQuickStart',
    metadata: { name: id },
    spec: {
      displayName: 'Example walkthrough',
      description: 'Practice a task.',
      introduction: 'Start here.',
      durationMinutes: 5,
      tasks: [
        {
          title: 'Try it',
          description: '`oc get vm`{{execute}}\n```yaml\nkind: VirtualMachine\n```{{copy}}',
          review: { instructions: 'Did it work?', failedTaskHelp: 'Try again.' },
          summary: { success: 'Done.', failed: 'Retry.' },
        },
      ],
    },
  };
}

function replaceField(value: unknown, path: string, replacement: unknown): void {
  const parts = path.split('.');
  let parent = value as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) parent = parent[part] as Record<string, unknown>;
  parent[parts[parts.length - 1]] = replacement;
}

describe('YAML parsing', () => {
  it.each([
    ['malformed', 'spec: ['],
    ['duplicate key', 'name: alpha\nname: beta'],
    ['multiple documents', 'name: alpha\n---\nname: beta'],
    ['empty document', ''],
  ])('rejects %s YAML with its filename', (_name, input) => {
    expect(() => parseYaml(input, 'cards.yaml')).toThrow('cards.yaml');
  });

  it('preserves scalar types', () => {
    expect(parseYaml('enabled: false\nquoted: "false"', 'values.yaml')).toEqual({
      enabled: false,
      quoted: 'false',
    });
  });
});

describe('QuickStart structure', () => {
  it('preserves supported Markdown markers', () => {
    const value = resource();
    expect(validateResource(value, 'alpha.yaml', 'alpha')).toEqual(value);
    expect(value.spec.tasks[0].description).toContain('{{execute}}');
    expect(value.spec.tasks[0].description).toContain('{{copy}}');
  });

  it('accepts omitted optional review and summary', () => {
    const value = resource();
    Reflect.deleteProperty(value.spec.tasks[0], 'review');
    Reflect.deleteProperty(value.spec.tasks[0], 'summary');
    expect(() => validateResource(value, 'alpha.yaml', 'alpha')).not.toThrow();
  });

  it.each([
    ['apiVersion', 'console.openshift.io/v2'],
    ['kind', 'ConfigMap'],
    ['metadata.name', 'other'],
    ['metadata.namespace', 'default'],
    ['spec', null],
    ['spec.displayName', '   '],
    ['spec.introduction', undefined],
    ['spec.description', 'a'.repeat(257)],
    ['spec.durationMinutes', 0],
    ['spec.durationMinutes', -1],
    ['spec.durationMinutes', 1.5],
    ['spec.durationMinutes', '5'],
    ['spec.tasks', []],
    ['spec.tasks', {}],
    ['spec.tasks.0.title', false],
    ['spec.tasks.0.description', ''],
    ['spec.tasks.0.review', null],
    ['spec.tasks.0.review.instructions', ''],
    ['spec.tasks.0.review.failedTaskHelp', undefined],
    ['spec.tasks.0.summary', []],
    ['spec.tasks.0.summary.success', 1],
    ['spec.tasks.0.summary.failed', 'a'.repeat(129)],
    ['spec.tags', 'virtualization'],
    ['spec.prerequisites', [true]],
    ['spec.nextQuickStart', [1]],
    ['spec.icon', false],
    ['spec.conclusion', {}],
  ])('rejects invalid %s (%p)', (path, replacement) => {
    const value = resource();
    replaceField(value, path, replacement);
    expect(() => validateResource(value, 'alpha.yaml', 'alpha')).toThrow(
      `alpha.yaml.${path.replace('.0.', '[0].')}`,
    );
  });

  it('accepts exact length bounds, counting Unicode code points', () => {
    const value = resource();
    value.spec.description = '😀'.repeat(256);
    value.spec.tasks[0].summary.failed = 'a'.repeat(128);
    expect(() => validateResource(value, 'alpha.yaml', 'alpha')).not.toThrow();
  });
});

describe('Helm and registry validation', () => {
  let root: string;
  let switches: Record<string, { enabled: boolean | string }>;
  let cards: { id: string; kind: string; quickStartId?: string }[];
  let values: { plugin: Record<string, unknown> };

  function writeRegistry(): void {
    values.plugin.quickStarts = switches;
    writeFileSync(join(root, chartPath, 'values.yaml'), stringify(values));
    writeFileSync(join(root, 'src/cards.yaml'), stringify(cards));
  }

  function writeTemplate(id: string, body = stringify(resource(id)), toggle = id): void {
    writeFileSync(
      join(root, templatePath, `${id}.yaml`),
      `{{- if (index .Values.plugin.quickStarts "${toggle}").enabled }}\n${body}{{- end }}\n`,
    );
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'quickstarts-test-'));
    cpSync(resolve(chartPath), join(root, chartPath), { recursive: true });
    rmSync(join(root, templatePath), { recursive: true });
    mkdirSync(join(root, templatePath));
    mkdirSync(join(root, 'src'));
    values = parseYaml(
      readFileSync(join(root, chartPath, 'values.yaml'), 'utf8'),
      'values.yaml',
    ) as typeof values;
    switches = { alpha: { enabled: true }, beta: { enabled: false } };
    cards = [
      { id: 'page', kind: 'page' },
      ...['alpha', 'beta'].map((id) => ({ id, kind: 'quickstart', quickStartId: id })),
    ];
    writeRegistry();
    // Helm must receive escaped Console markers in templates, but emit them literally.
    for (const id of ['alpha', 'beta']) {
      writeTemplate(id, stringify(resource(id)).replace(/{{(execute|copy)}}/g, '{{"{{$1}}"}}'));
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('checks defaults, all enabled, each disabled, and all disabled using real Helm', () => {
    expect(validateQuickStarts(root)).toBe(2);
  });

  it('automatically discovers an added walkthrough', () => {
    switches.gamma = { enabled: true };
    cards.push({ id: 'gamma', kind: 'quickstart', quickStartId: 'gamma' });
    writeRegistry();
    const value = resource('gamma');
    value.spec.tasks[0].description = 'New task.';
    writeTemplate('gamma', stringify(value));
    expect(validateQuickStarts(root)).toBe(3);
  });

  it('accepts coordinated removal', () => {
    delete switches.beta;
    cards = cards.filter((card) => card.id !== 'beta');
    writeRegistry();
    rmSync(join(root, templatePath, 'beta.yaml'));
    expect(validateQuickStarts(root)).toBe(1);
  });

  it('accepts removal of the last walkthrough and its directory', () => {
    switches = {};
    cards = cards.filter((card) => card.kind !== 'quickstart');
    writeRegistry();
    rmSync(join(root, templatePath), { recursive: true });
    expect(validateQuickStarts(root)).toBe(0);
  });

  it.each(['card', 'toggle', 'template'])('rejects removal of only the %s', (part) => {
    if (part === 'card') cards = cards.filter((card) => card.id !== 'alpha');
    if (part === 'toggle') delete switches.alpha;
    if (part === 'template') rmSync(join(root, templatePath, 'alpha.yaml'));
    writeRegistry();
    expect(() => validateQuickStarts(root)).toThrow(/IDs do not match.*alpha/);
  });

  it('rejects duplicate card IDs across kinds', () => {
    cards.push({ id: 'alpha', kind: 'cookbook' });
    writeRegistry();
    expect(() => validateQuickStarts(root)).toThrow('duplicate card ID alpha');
  });

  it('rejects mismatched launch IDs', () => {
    cards[1].quickStartId = 'beta';
    writeRegistry();
    expect(() => validateQuickStarts(root)).toThrow(
      'src/cards.yaml[1].quickStartId: expected alpha',
    );
  });

  it('rejects a string toggle', () => {
    switches.alpha.enabled = 'false';
    writeRegistry();
    expect(() => validateQuickStarts(root)).toThrow(
      'plugin.quickStarts.alpha.enabled: expected a Boolean',
    );
  });

  it('rejects duplicate YAML keys in the registry', () => {
    writeFileSync(join(root, 'src/cards.yaml'), '- id: alpha\n  id: beta');
    expect(() => validateQuickStarts(root)).toThrow(/src\/cards.yaml.*Map keys must be unique/s);
  });

  it('rejects duplicate template basenames', () => {
    cpSync(join(root, templatePath, 'alpha.yaml'), join(root, templatePath, 'alpha.yml'));
    expect(() => validateQuickStarts(root)).toThrow('duplicate template ID alpha');
  });

  it.each([
    ['invalid Helm', '{{ unknownFunction }}', /helm lint.*failed/s],
    ['invalid YAML', 'kind: [', /helm lint.*failed/s],
    [
      'wrong kind',
      'kind: ConfigMap\napiVersion: console.openshift.io/v1\n',
      /alpha.yaml.kind: expected ConsoleQuickStart/,
    ],
    [
      'missing spec',
      'apiVersion: console.openshift.io/v1\nkind: ConsoleQuickStart\nmetadata:\n  name: alpha\n',
      /alpha.yaml.spec: expected a mapping/,
    ],
    ['empty template', '', /all enabled: IDs do not match; missing: \[alpha\]/],
  ])('rejects %s output', (_name, body, error) => {
    writeTemplate('alpha', body);
    expect(() => validateQuickStarts(root)).toThrow(error);
  });

  it('rejects duplicate rendered resources from one template', () => {
    const value = resource();
    value.spec.tasks[0].description = 'Task.';
    writeTemplate('alpha', `${stringify(value)}---\n${stringify(value)}`);
    expect(() => validateQuickStarts(root)).toThrow('expected exactly one resource per template');
  });

  it('rejects duplicate keys in rendered YAML', () => {
    const value = resource();
    value.spec.tasks[0].description = 'Task.';
    writeTemplate('alpha', `${stringify(value)}kind: ConsoleQuickStart\n`);
    expect(() => validateQuickStarts(root)).toThrow('Map keys must be unique');
  });

  it('detects a condition that reads another walkthrough toggle', () => {
    switches.beta.enabled = true;
    writeRegistry();
    const value = resource();
    value.spec.tasks[0].description = 'Task.';
    writeTemplate('alpha', stringify(value), 'beta');
    expect(() => validateQuickStarts(root)).toThrow(/disabled alpha: IDs do not match.*alpha/);
  });

  it('detects a template that ignores its toggle', () => {
    const value = resource();
    value.spec.tasks[0].description = 'Task.';
    writeFileSync(join(root, templatePath, 'alpha.yaml'), stringify(value));
    expect(() => validateQuickStarts(root)).toThrow(/disabled alpha: IDs do not match.*alpha/);
  });

  it('detects content that changes with another toggle', () => {
    switches.beta.enabled = true;
    writeRegistry();
    const value = resource();
    value.spec.tasks[0].description = 'Task.';
    writeTemplate(
      'alpha',
      stringify(value).replace(
        'Practice a task.',
        '{{ if (index .Values.plugin.quickStarts "beta").enabled }}First.{{ else }}Second.{{ end }}',
      ),
    );
    expect(() => validateQuickStarts(root)).toThrow(
      'resource changed when another QuickStart was disabled',
    );
  });
});
