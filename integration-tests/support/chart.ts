import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PLUGIN_NAME = 'partner-labs-console-plugin';
const PLUGIN_TEMPLATE_PULL_SPEC =
  process.env.PLUGIN_TEMPLATE_PULL_SPEC ?? process.env.CYPRESS_PLUGIN_TEMPLATE_PULL_SPEC;
const PLUGIN_IMAGE_PULL_SECRET = process.env.PLUGIN_IMAGE_PULL_SECRET;
const SKIP_PATCH_JOB = process.env.PLUGIN_SKIP_PATCH_JOB === 'true';
const STATE_PATH = resolve('integration-tests/.auth/chart-state.json');

interface ChartState {
  helmPath: string;
}

function runCommand(command: string, args: string[] = []) {
  return execFileSync(command, args, { timeout: 1_800_000, encoding: 'utf-8' });
}

// Use an existing Helm 3 or Helm 4 installation. Fall back to the script used by
// the OpenShift CI job when Helm is not on PATH.
function resolveHelm(): string {
  try {
    const version = runCommand('helm', ['version', '--short']).trim();
    if (/^v[34]\./.test(version)) {
      return 'helm';
    }
  } catch {
    // Fall through to the installer below.
  }
  console.log('No supported Helm installation was found, downloading it to /tmp');
  runCommand('./install_helm.sh');
  return '/tmp/helm';
}

function consoleDeploymentGeneration(): number {
  return Number(
    runCommand('oc', [
      'get',
      'deployment/console',
      '-n',
      'openshift-console',
      '-o',
      'jsonpath={.metadata.generation}',
    ]).trim(),
  );
}

interface ClusterOperatorStatus {
  status?: {
    conditions?: { type: string; status: string }[];
  };
}

function clusterOperatorStable(name: string): boolean {
  const operator = JSON.parse(
    runCommand('oc', ['get', `clusteroperator/${name}`, '-o', 'json']),
  ) as ClusterOperatorStatus;
  const conditions = operator.status?.conditions ?? [];
  const condition = (type: string) => conditions.find((item) => item.type === type)?.status;
  return (
    condition('Available') === 'True' &&
    condition('Progressing') === 'False' &&
    condition('Degraded') === 'False'
  );
}

// The console session cookie name contains the console deployment hash, so a
// console rollout logs out every browser session. Wait for the console operator
// and the console deployment to settle after the plugin patch.
function waitForConsoleStable(): void {
  const deadline = Date.now() + 15 * 60_000;
  const stableFor = 5 * 60_000;
  let lastGeneration = consoleDeploymentGeneration();
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    runCommand('sleep', ['5']);
    const generation = consoleDeploymentGeneration();
    const operatorsStable =
      clusterOperatorStable('console') && clusterOperatorStable('authentication');
    if (!operatorsStable || generation !== lastGeneration) {
      lastGeneration = generation;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince >= stableFor) {
      return;
    }
  }

  throw new Error('The console did not stabilize before the E2E timeout.');
}

export function installHelmChart(): void {
  if (!PLUGIN_TEMPLATE_PULL_SPEC) {
    throw new Error('Set PLUGIN_TEMPLATE_PULL_SPEC to the plugin image before running E2E tests.');
  }

  const helmPath = resolveHelm();
  const pullSecretArgs = PLUGIN_IMAGE_PULL_SECRET
    ? ['--set', `plugin.imagePullSecrets[0].name=${PLUGIN_IMAGE_PULL_SECRET}`]
    : [];
  // OKD uses a dummy cluster pull secret, so the chart's patcher image from
  // registry.redhat.io cannot be pulled. Patch the console operator directly.
  const patchArgs = SKIP_PATCH_JOB ? ['--set', 'plugin.jobs.patchConsoles.enabled=false'] : [];
  const result = runCommand(helmPath, [
    'upgrade',
    '-i',
    PLUGIN_NAME,
    'charts/partner-labs-console-plugin',
    '-n',
    PLUGIN_NAME,
    '--create-namespace',
    '--timeout',
    '10m',
    '--set',
    `plugin.image=${PLUGIN_TEMPLATE_PULL_SPEC}`,
    ...patchArgs,
    ...pullSecretArgs,
  ]);
  console.log('Helm install:', result);

  runCommand('oc', [
    'rollout',
    'status',
    '-n',
    PLUGIN_NAME,
    `deploy/${PLUGIN_NAME}`,
    '-w',
    '--timeout=600s',
  ]);

  if (SKIP_PATCH_JOB) {
    const generation = consoleDeploymentGeneration();
    runCommand('oc', [
      'patch',
      'consoles.operator.openshift.io',
      'cluster',
      '--type=merge',
      '-p',
      `{"spec":{"plugins":["${PLUGIN_NAME}"]}}`,
    ]);
    // Wait for the console operator to start a new console rollout. Without
    // this, the rollout check below can pass against the old console.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (consoleDeploymentGeneration() > generation) {
        break;
      }
      runCommand('sleep', ['5']);
    }
  }

  runCommand('oc', [
    'rollout',
    'status',
    '-w',
    'deploy/console',
    '-n',
    'openshift-console',
    '--timeout=600s',
  ]);

  waitForConsoleStable();

  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ helmPath } satisfies ChartState));
}

export function deleteHelmChart(): void {
  if (!existsSync(STATE_PATH)) {
    return;
  }

  let helmPath = 'helm';
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as ChartState;
    helmPath = state.helmPath;
  } catch (error) {
    console.warn('Could not read the chart state file:', error);
  }

  try {
    const result = runCommand(helmPath, ['uninstall', PLUGIN_NAME, '-n', PLUGIN_NAME]);
    console.log('Helm uninstall:', result);
    runCommand('oc', ['delete', 'namespaces', PLUGIN_NAME]);
  } catch (error) {
    console.warn('Chart cleanup failed:', error);
  } finally {
    try {
      unlinkSync(STATE_PATH);
    } catch {
      // The state file may already be gone.
    }
  }
}
