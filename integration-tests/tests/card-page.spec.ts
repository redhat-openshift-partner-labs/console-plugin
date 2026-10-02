import { execFileSync } from 'child_process';
import { test, expect } from '@playwright/test';
import { checkErrors } from '../support';

const PLUGIN_NAME = 'partner-labs-console-plugin';
// Defined in openshift/release ci-operator config as CYPRESS_PLUGIN_TEMPLATE_PULL_SPEC
const PLUGIN_TEMPLATE_PULL_SPEC =
  process.env.PLUGIN_TEMPLATE_PULL_SPEC ?? process.env.CYPRESS_PLUGIN_TEMPLATE_PULL_SPEC;

const isLocalDevEnvironment = (process.env.BRIDGE_BASE_ADDRESS ?? 'http://localhost:9000').includes(
  'localhost',
);
let chartInstalled = false;

function runCommand(command: string, args: string[] = []) {
  return execFileSync(command, args, { timeout: 360000, encoding: 'utf-8' });
}

function installHelmChart(helmPath: string) {
  if (!PLUGIN_TEMPLATE_PULL_SPEC) {
    throw new Error('Set PLUGIN_TEMPLATE_PULL_SPEC to the plugin image before running E2E tests.');
  }

  const result = runCommand(helmPath, [
    'upgrade',
    '-i',
    PLUGIN_NAME,
    'charts/partner-labs-console-plugin',
    '-n',
    PLUGIN_NAME,
    '--create-namespace',
    '--set',
    `plugin.image=${PLUGIN_TEMPLATE_PULL_SPEC}`,
  ]);
  chartInstalled = true;
  console.log('Helm install:', result);

  runCommand('oc', [
    'rollout',
    'status',
    '-n',
    PLUGIN_NAME,
    `deploy/${PLUGIN_NAME}`,
    '-w',
    '--timeout=300s',
  ]);
  runCommand('oc', [
    'rollout',
    'status',
    '-w',
    'deploy/console',
    '-n',
    'openshift-console',
    '--timeout=300s',
  ]);
}

function deleteHelmChart(helmPath: string) {
  const result = runCommand(helmPath, ['uninstall', PLUGIN_NAME, '-n', PLUGIN_NAME]);
  console.log('Helm uninstall:', result);
  runCommand('oc', ['delete', 'namespaces', PLUGIN_NAME]);
}

test.describe('Console plugin cards', () => {
  test.beforeAll(() => {
    test.setTimeout(360_000);
    if (!isLocalDevEnvironment) {
      console.log('this is not a local env, installing helm');
      runCommand('./install_helm.sh');
      installHelmChart('/tmp/helm');
    } else {
      console.log('this is a local env, not installing helm');
      installHelmChart('helm');
    }
  });

  test.afterEach(async ({ page }) => {
    await checkErrors(page);
  });

  test.afterAll(() => {
    test.setTimeout(360_000);
    if (!chartInstalled) {
      return;
    }
    if (!isLocalDevEnvironment) {
      deleteHelmChart('/tmp/helm');
    } else {
      deleteHelmChart('helm');
    }
  });

  test('opens the custom page card', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-page').click();
    await expect(page).toHaveURL(/\/partner-labs-example$/);
    await expect(page.getByRole('heading', { name: 'Custom Page' })).toBeVisible();
    await expect(page.getByText('Console SDK examples')).toBeVisible();
    await expect(page.getByTestId('copy-example-command')).toBeVisible();
  });

  test('shows the project selector on the demos page', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await expect(page.locator('[data-test-id="namespace-bar-dropdown"]')).toBeVisible();
    await expect(page.getByTestId('card-pipeline')).toBeVisible();
  });

  test('opens the VM creation quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-create-vm-web-console').click();
    await expect(
      page.getByRole('heading', { name: 'Create a VM from the web console', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Open VirtualMachines and select a project', { exact: true }),
    ).toBeVisible();
  });

  test('opens the OpenShift Virtualization installation quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-install-configure-ocpv-operator').click();
    await expect(
      page.getByRole('heading', {
        name: 'Install and configure OpenShift Virtualization',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Open OperatorHub', { exact: true })).toBeVisible();
  });

  test('opens the custom VM templates quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-vm-templates').click();
    await expect(
      page.getByRole('heading', { name: 'Create custom VM templates', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Inspect a supplied VM template', { exact: true })).toBeVisible();
  });
});
