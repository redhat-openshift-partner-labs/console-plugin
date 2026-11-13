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

  test('opens the Windows golden images quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-windows-golden-images').click();
    await expect(
      page.getByRole('heading', { name: 'Create Windows golden images', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Prepare a dedicated project', { exact: true })).toBeVisible();
  });

  test('opens the VM ingress routes quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-vm-ingress-routes').click();
    await expect(
      page.getByRole('heading', { name: 'Expose a VM with an HTTPS Route', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Create a dedicated test project', { exact: true })).toBeVisible();
  });

  test('opens the VM lifecycle states quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-vm-lifecycle-states').click();
    await expect(
      page.getByRole('heading', { name: 'Understanding VM lifecycle states', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Understand VM and VMI resources', { exact: true })).toBeVisible();
  });

  test('opens the VM network policies quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-network-policies-vms').click();
    await expect(
      page.getByRole('heading', { name: 'VM Cookbook: Network Policies for VMs', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Create the demo project and clients', { exact: true }),
    ).toBeVisible();
  });

  test('opens the static IP configuration quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-static-ip-configuration').click();
    await expect(
      page.getByRole('heading', { name: 'VM Cookbook: Static IP Configuration', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Create a dedicated test project', { exact: true })).toBeVisible();
  });

  test('opens the LVM Storage Operator quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-install-lvm-storage-operator').click();
    await expect(
      page.getByRole('heading', {
        name: 'Install the LVM Storage Operator',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Identify a spare disk', { exact: true })).toBeVisible();
  });

  test('opens the CLI YAML VM quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-create-vm-cli-yaml').click();
    await expect(
      page.getByRole('heading', { name: 'Create a VM with CLI YAML', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Create a project and verify the boot source', { exact: true }),
    ).toBeVisible();
  });

  test('opens the virtctl basics quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-virtctl-basics').click();
    await expect(
      page.getByRole('heading', { name: 'Using virtctl for VM management', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Install virtctl', { exact: true })).toBeVisible();
  });

  test('opens the multi-disk configuration quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-multi-disk-configuration').click();
    await expect(
      page.getByRole('heading', { name: 'Configure multiple VM disks', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Choose the StorageClass and create a project', { exact: true }),
    ).toBeVisible();
  });

  test('opens the custom VM templates quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-vm-templates').click();
    await expect(
      page.getByRole('heading', { name: 'Create custom VM templates', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Inspect a supplied VM template', { exact: true })).toBeVisible();
  });

  test('opens the Cloud-init Fundamentals quick start', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-cloud-init-fundamentals').click();
    await expect(
      page.getByRole('heading', { name: 'Cloud-init Fundamentals', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Check the Fedora boot source')).toBeVisible();
  });

  test('opens the VM export and import walkthrough', async ({ page }) => {
    await page.goto('/partner-labs-demos');
    await page.getByTestId('card-action-vm-export-import').click();
    await expect(page).toHaveURL((url) => url.pathname === '/partner-labs-demos');
    await expect(
      page.getByRole('heading', {
        name: 'Exporting and Importing VMs for Cross-Cluster Mobility',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'OpenShift Virtualization cookbook', exact: true }),
    ).toHaveAttribute(
      'href',
      'https://redhatquickcourses.github.io/ocp-virt-cookbook/ocp-virt-cookbook/1/vm-lifecycle/vm-export-import.html',
    );
    await expect(
      page.getByText('Prepare the source and target projects', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Export the disk to a container registry', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Import the disk on the target cluster', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Download disks and manifests for offline use (optional CLI)', {
        exact: true,
      }),
    ).toBeVisible();
  });
});
