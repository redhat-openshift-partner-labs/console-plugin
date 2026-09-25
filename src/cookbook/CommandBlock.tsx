import { k8sCreate, k8sGet, k8sListItems } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ClipboardCopyButton,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
  Label,
  Tooltip,
} from '@patternfly/react-core';
import { useCallback, useState, type FC } from 'react';
import { MANAGED_BY, MANAGED_BY_VALUE } from '../data/labels';
import { ALL_NAMESPACES_KEY } from '../data/namespace';

const DataSourceModel = {
  apiVersion: 'v1beta1',
  apiGroup: 'cdi.kubevirt.io',
  kind: 'DataSource',
  abbr: 'DS',
  label: 'DataSource',
  labelPlural: 'DataSources',
  plural: 'datasources',
  namespaced: true,
};

const TemplateModel = {
  apiVersion: 'v1',
  apiGroup: 'template.openshift.io',
  kind: 'Template',
  abbr: 'T',
  label: 'Template',
  labelPlural: 'Templates',
  plural: 'templates',
  namespaced: true,
};

const VirtualMachineModel = {
  apiVersion: 'v1',
  apiGroup: 'kubevirt.io',
  kind: 'VirtualMachine',
  abbr: 'VM',
  label: 'VirtualMachine',
  labelPlural: 'VirtualMachines',
  plural: 'virtualmachines',
  namespaced: true,
};

const ProjectRequestModel = {
  apiVersion: 'v1',
  apiGroup: 'project.openshift.io',
  kind: 'ProjectRequest',
  abbr: 'PR',
  label: 'ProjectRequest',
  labelPlural: 'ProjectRequests',
  plural: 'projectrequests',
  namespaced: false,
};

const DataVolumeModel = {
  apiVersion: 'v1beta1',
  apiGroup: 'cdi.kubevirt.io',
  kind: 'DataVolume',
  abbr: 'DV',
  label: 'DataVolume',
  labelPlural: 'DataVolumes',
  plural: 'datavolumes',
  namespaced: true,
};

type CommandStatus = 'idle' | 'running' | 'success' | 'error';
let nextCopyId = 0;

export interface CommandResult {
  status: CommandStatus;
  message?: string;
  detail?: string;
}

export const CommandBlock: FC<{
  command: string;
  action?: string;
  namespace: string;
  onResult: (result: CommandResult) => void;
  result: CommandResult;
}> = ({ command, action, namespace, onResult, result }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const [copyId] = useState(() => `partner-labs-copy-${(++nextCopyId).toString()}`);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const placeholders = Array.from(command.matchAll(/<([^<>]+)>/g), (match) => match[1]);
  const needsProject =
    (action === 'create-vm' || action === 'create-custom-template') &&
    namespace === ALL_NAMESPACES_KEY;
  const handleRun = useCallback(async () => {
    if (needsProject) return;
    setOutputExpanded(true);
    onResult({ status: 'running' });
    try {
      switch (action) {
        case 'list-datasources': {
          const items = await k8sListItems({
            model: DataSourceModel,
            queryParams: { ns: 'openshift-virtualization-os-images' },
          });
          const header = 'NAME                          SOURCE STATUS         AGE';
          const rows = items.map((ds) => {
            const name = (ds.metadata?.name ?? '').padEnd(30);
            const conditions =
              (ds as { status?: { conditions?: { type: string; status: string }[] } }).status
                ?.conditions ?? [];
            const ready = conditions.find((c) => c.type === 'Ready');
            const sourceStatus = ready?.status === 'True' ? 'Ready' : 'Not Ready';
            const created = ds.metadata?.creationTimestamp
              ? new Date(ds.metadata.creationTimestamp).toLocaleDateString()
              : '';
            return `${name} ${sourceStatus.padEnd(15)} ${created}`;
          });
          onResult({
            status: 'success',
            message: t('Found {{count}} DataSources in openshift-virtualization-os-images', {
              count: items.length,
            }),
            detail: [header, ...rows].join('\n'),
          });
          break;
        }
        case 'get-template': {
          const template = await k8sGet({
            model: TemplateModel,
            name: 'fedora-server-small',
            ns: 'openshift',
          });
          const yaml = JSON.parse(JSON.stringify(template)) as typeof template;
          delete yaml.metadata?.managedFields;
          onResult({
            status: 'success',
            message: t('Template "{{name}}" in namespace "openshift"', {
              name: template.metadata?.name,
            }),
            detail: JSON.stringify(yaml, null, 2),
          });
          break;
        }
        case 'create-vm': {
          const vmName = `demo-vm-${Date.now().toString(36)}`;
          await k8sCreate({
            model: VirtualMachineModel,
            ns: namespace,
            data: {
              apiVersion: 'kubevirt.io/v1',
              kind: 'VirtualMachine',
              metadata: {
                name: vmName,
                namespace,
                labels: {
                  [MANAGED_BY]: MANAGED_BY_VALUE,
                },
              },
              spec: {
                running: true,
                template: {
                  metadata: {
                    labels: {
                      'kubevirt.io/domain': vmName,
                    },
                  },
                  spec: {
                    domain: {
                      devices: {
                        disks: [{ name: 'rootdisk', disk: { bus: 'virtio' } }],
                        interfaces: [{ name: 'default', masquerade: {} }],
                      },
                      resources: { requests: { memory: '2Gi' } },
                    },
                    networks: [{ name: 'default', pod: {} }],
                    volumes: [
                      {
                        name: 'rootdisk',
                        dataVolume: { name: `${vmName}-rootdisk` },
                      },
                    ],
                  },
                },
                dataVolumeTemplates: [
                  {
                    metadata: { name: `${vmName}-rootdisk` },
                    spec: {
                      sourceRef: {
                        kind: 'DataSource',
                        name: 'fedora',
                        namespace: 'openshift-virtualization-os-images',
                      },
                      storage: { resources: { requests: { storage: '30Gi' } } },
                    },
                  },
                ],
              },
            } as never,
          });
          onResult({
            status: 'success',
            message: t('VM "{{name}}" created in namespace "{{ns}}"', {
              name: vmName,
              ns: namespace,
            }),
          });
          break;
        }
        case 'list-templates': {
          const items = await k8sListItems({
            model: TemplateModel,
            queryParams: { ns: 'openshift' },
          });
          const vmTemplates = items.filter((tpl) => {
            const labels = tpl.metadata?.labels ?? {};
            return Object.keys(labels).some((k) => k.startsWith('os.template.kubevirt.io/'));
          });
          const header = 'NAME                                DESCRIPTION';
          const rows = vmTemplates.map((tpl) => {
            const name = (tpl.metadata?.name ?? '').padEnd(36);
            const desc = tpl.metadata?.annotations?.description ?? '';
            const truncated = desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
            return `${name} ${truncated}`;
          });
          onResult({
            status: 'success',
            message: t('Found {{count}} VM templates in openshift namespace', {
              count: vmTemplates.length,
            }),
            detail: [header, ...rows].join('\n'),
          });
          break;
        }
        case 'get-rhel9-template': {
          const template = await k8sGet({
            model: TemplateModel,
            name: 'rhel9-server-medium',
            ns: 'openshift',
          });
          const cleaned = JSON.parse(JSON.stringify(template)) as typeof template;
          delete cleaned.metadata?.managedFields;
          onResult({
            status: 'success',
            message: t('Template "{{name}}" in namespace "openshift"', {
              name: template.metadata?.name,
            }),
            detail: JSON.stringify(cleaned, null, 2),
          });
          break;
        }
        case 'create-template-project': {
          await k8sCreate({
            model: ProjectRequestModel,
            data: {
              apiVersion: 'project.openshift.io/v1',
              kind: 'ProjectRequest',
              metadata: { name: 'template-example' },
              displayName: 'Template Example',
              description: 'Project for VM template demos',
            } as never,
          });
          onResult({
            status: 'success',
            message: t('Project "template-example" created'),
          });
          break;
        }
        case 'deploy-from-template': {
          const vmName = `rhel9-${Date.now().toString(36)}`;
          await k8sCreate({
            model: VirtualMachineModel,
            ns: 'template-example',
            data: {
              apiVersion: 'kubevirt.io/v1',
              kind: 'VirtualMachine',
              metadata: {
                name: vmName,
                namespace: 'template-example',
                labels: {
                  app: vmName,
                  [MANAGED_BY]: MANAGED_BY_VALUE,
                  'vm.kubevirt.io/template': 'rhel9-server-medium',
                },
              },
              spec: {
                runStrategy: 'Halted',
                dataVolumeTemplates: [
                  {
                    apiVersion: 'cdi.kubevirt.io/v1beta1',
                    kind: 'DataVolume',
                    metadata: { name: vmName },
                    spec: {
                      sourceRef: {
                        kind: 'DataSource',
                        name: 'rhel9',
                        namespace: 'openshift-virtualization-os-images',
                      },
                      storage: { resources: { requests: { storage: '30Gi' } } },
                    },
                  },
                ],
                template: {
                  metadata: {
                    labels: { 'kubevirt.io/domain': vmName, 'kubevirt.io/size': 'medium' },
                  },
                  spec: {
                    architecture: 'amd64',
                    domain: {
                      cpu: { cores: 1, sockets: 1, threads: 1 },
                      devices: {
                        disks: [
                          { disk: { bus: 'virtio' }, name: 'rootdisk' },
                          { disk: { bus: 'virtio' }, name: 'cloudinitdisk' },
                        ],
                        interfaces: [{ masquerade: {}, model: 'virtio', name: 'default' }],
                        rng: {},
                      },
                      features: { smm: { enabled: true } },
                      firmware: { bootloader: { efi: {} } },
                      memory: { guest: '4Gi' },
                    },
                    networks: [{ name: 'default', pod: {} }],
                    terminationGracePeriodSeconds: 180,
                    volumes: [
                      { dataVolume: { name: vmName }, name: 'rootdisk' },
                      {
                        cloudInitNoCloud: {
                          userData:
                            '#cloud-config\nuser: cloud-user\npassword: demo-pass\nchpasswd:\n  expire: false\n',
                        },
                        name: 'cloudinitdisk',
                      },
                    ],
                  },
                },
              },
            } as never,
          });
          onResult({
            status: 'success',
            message: t(
              'VM "{{name}}" created in namespace "template-example" (Halted — use virtctl start to boot)',
              { name: vmName },
            ),
          });
          break;
        }
        case 'get-template-resources': {
          const vms = await k8sListItems({
            model: VirtualMachineModel,
            queryParams: { ns: 'template-example' },
          });
          const header = 'NAME                              STATUS         CREATED';
          const rows = vms.map((vm) => {
            const name = (vm.metadata?.name ?? '').padEnd(34);
            const status =
              (vm as { status?: { printableStatus?: string } }).status?.printableStatus ??
              'Unknown';
            const created = vm.metadata?.creationTimestamp
              ? new Date(vm.metadata.creationTimestamp).toLocaleString()
              : '';
            return `${name} ${status.padEnd(15)} ${created}`;
          });
          onResult({
            status: 'success',
            message: t('Found {{count}} VMs in template-example', { count: vms.length }),
            detail: [header, ...rows].join('\n'),
          });
          break;
        }
        case 'create-custom-template': {
          await k8sCreate({
            model: TemplateModel,
            ns: namespace,
            data: {
              apiVersion: 'template.openshift.io/v1',
              kind: 'Template',
              metadata: {
                name: 'rhel9-custom',
                namespace,
                annotations: {
                  'defaults.template.kubevirt.io/disk': 'rootdisk',
                  description:
                    'Custom RHEL 9 template with auto-start and configurable cloud-init user',
                  iconClass: 'icon-rhel',
                  'openshift.io/display-name': 'RHEL 9 Custom VM',
                  'openshift.io/provider-display-name': 'Partner Labs',
                  tags: 'kubevirt,virtualmachine,linux,rhel',
                  'template.kubevirt.io/provider': 'Partner Labs',
                },
                labels: {
                  'flavor.template.kubevirt.io/medium': 'true',
                  'os.template.kubevirt.io/rhel9.0': 'true',
                  'template.kubevirt.io/type': 'base',
                  'workload.template.kubevirt.io/server': 'true',
                },
              },
              objects: [
                {
                  apiVersion: 'kubevirt.io/v1',
                  kind: 'VirtualMachine',
                  metadata: {
                    name: '${NAME}',
                    labels: { app: '${NAME}' },
                  },
                  spec: {
                    runStrategy: 'Always',
                    dataVolumeTemplates: [
                      {
                        apiVersion: 'cdi.kubevirt.io/v1beta1',
                        kind: 'DataVolume',
                        metadata: { name: '${NAME}' },
                        spec: {
                          sourceRef: {
                            kind: 'DataSource',
                            name: '${DATA_SOURCE_NAME}',
                            namespace: '${DATA_SOURCE_NAMESPACE}',
                          },
                          storage: { resources: { requests: { storage: '30Gi' } } },
                        },
                      },
                    ],
                    template: {
                      metadata: {
                        labels: { 'kubevirt.io/domain': '${NAME}', 'kubevirt.io/size': 'medium' },
                      },
                      spec: {
                        architecture: 'amd64',
                        domain: {
                          cpu: { cores: 1, sockets: 1, threads: 1 },
                          devices: {
                            disks: [
                              { disk: { bus: 'virtio' }, name: 'rootdisk' },
                              { disk: { bus: 'virtio' }, name: 'cloudinitdisk' },
                            ],
                            interfaces: [{ masquerade: {}, model: 'virtio', name: 'default' }],
                            rng: {},
                          },
                          features: { smm: { enabled: true } },
                          firmware: { bootloader: { efi: {} } },
                          memory: { guest: '4Gi' },
                        },
                        networks: [{ name: 'default', pod: {} }],
                        terminationGracePeriodSeconds: 180,
                        volumes: [
                          { dataVolume: { name: '${NAME}' }, name: 'rootdisk' },
                          {
                            cloudInitNoCloud: {
                              userData:
                                '#cloud-config\nuser: ${CLOUD_INIT_USERNAME}\npassword: ${CLOUD_INIT_PASSWORD}\nchpasswd:\n  expire: false\n',
                            },
                            name: 'cloudinitdisk',
                          },
                        ],
                      },
                    },
                  },
                },
              ],
              parameters: [
                {
                  description: 'VM name',
                  from: 'rhel9-custom-[a-z0-9]{6}',
                  generate: 'expression',
                  name: 'NAME',
                },
                {
                  description: 'Name of the DataSource to clone',
                  name: 'DATA_SOURCE_NAME',
                  value: 'rhel9',
                },
                {
                  description: 'Namespace of the DataSource',
                  name: 'DATA_SOURCE_NAMESPACE',
                  value: 'openshift-virtualization-os-images',
                },
                {
                  description: 'Cloud-init username',
                  name: 'CLOUD_INIT_USERNAME',
                  value: 'shadowman',
                },
                {
                  description: 'Cloud-init password',
                  from: '[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}',
                  generate: 'expression',
                  name: 'CLOUD_INIT_PASSWORD',
                },
              ],
            } as never,
          });
          onResult({
            status: 'success',
            message: t('Custom template "rhel9-custom" created in namespace "{{ns}}"', {
              ns: namespace,
            }),
          });
          break;
        }
        case 'list-template-vms': {
          const vms = await k8sListItems({
            model: VirtualMachineModel,
            queryParams: { ns: 'template-example' },
          });
          const header = 'NAME                              STATUS         CREATED';
          const rows = vms.map((vm) => {
            const name = (vm.metadata?.name ?? '').padEnd(34);
            const status =
              (vm as { status?: { printableStatus?: string } }).status?.printableStatus ??
              'Unknown';
            const created = vm.metadata?.creationTimestamp
              ? new Date(vm.metadata.creationTimestamp).toLocaleString()
              : '';
            return `${name} ${status.padEnd(15)} ${created}`;
          });
          onResult({
            status: 'success',
            message: t('Found {{count}} VMs in template-example', { count: vms.length }),
            detail: [header, ...rows].join('\n'),
          });
          break;
        }
        case 'create-cloning-namespace': {
          await k8sCreate({
            model: ProjectRequestModel,
            data: {
              apiVersion: 'project.openshift.io/v1',
              kind: 'ProjectRequest',
              metadata: { name: 'vm-cloning-demo' },
              displayName: 'VM Cloning Demo',
              description: 'Namespace for VM cloning demonstrations',
            } as never,
          });
          onResult({
            status: 'success',
            message: t('Namespace "vm-cloning-demo" created'),
          });
          break;
        }
        case 'create-source-vm': {
          const vmName = 'source-webserver';
          await k8sCreate({
            model: VirtualMachineModel,
            ns: 'vm-cloning-demo',
            data: {
              apiVersion: 'kubevirt.io/v1',
              kind: 'VirtualMachine',
              metadata: {
                name: vmName,
                namespace: 'vm-cloning-demo',
                labels: {
                  [MANAGED_BY]: MANAGED_BY_VALUE,
                },
              },
              spec: {
                dataVolumeTemplates: [
                  {
                    apiVersion: 'cdi.kubevirt.io/v1beta1',
                    kind: 'DataVolume',
                    metadata: { name: `${vmName}-disk` },
                    spec: {
                      sourceRef: {
                        kind: 'DataSource',
                        name: 'fedora',
                        namespace: 'openshift-virtualization-os-images',
                      },
                      storage: { resources: { requests: { storage: '30Gi' } } },
                    },
                  },
                ],
                runStrategy: 'RerunOnFailure',
                template: {
                  metadata: {
                    labels: { 'kubevirt.io/domain': vmName },
                  },
                  spec: {
                    domain: {
                      cpu: { cores: 2 },
                      devices: {
                        disks: [
                          { disk: { bus: 'virtio' }, name: 'rootdisk' },
                          { disk: { bus: 'virtio' }, name: 'cloudinitdisk' },
                        ],
                        interfaces: [{ masquerade: {}, name: 'default' }],
                        rng: {},
                      },
                      memory: { guest: '4Gi' },
                    },
                    networks: [{ name: 'default', pod: {} }],
                    volumes: [
                      { dataVolume: { name: `${vmName}-disk` }, name: 'rootdisk' },
                      {
                        cloudInitNoCloud: {
                          userData:
                            '#cloud-config\nuser: fedora\npassword: fedora123\nchpasswd:\n  expire: false\nssh_pwauth: true\nruncmd:\n  - dnf install -y nginx\n  - systemctl enable --now nginx\n  - echo "<h1>Source Webserver VM</h1><p>Hostname: $(hostname)</p>" > /usr/share/nginx/html/index.html\n  - firewall-cmd --permanent --add-service=http\n  - firewall-cmd --reload\n',
                        },
                        name: 'cloudinitdisk',
                      },
                    ],
                  },
                },
              },
            } as never,
          });
          onResult({
            status: 'success',
            message: t('Source VM "{{name}}" created in namespace "vm-cloning-demo"', {
              name: vmName,
            }),
          });
          break;
        }
        case 'create-clone-datavolume': {
          const dvName = 'webserver-clone-2-disk';
          await k8sCreate({
            model: DataVolumeModel,
            ns: 'vm-cloning-demo',
            data: {
              apiVersion: 'cdi.kubevirt.io/v1beta1',
              kind: 'DataVolume',
              metadata: {
                name: dvName,
                namespace: 'vm-cloning-demo',
                annotations: {
                  'cdi.kubevirt.io/storage.bind.immediate.requested': 'true',
                },
              },
              spec: {
                source: {
                  pvc: {
                    name: 'source-webserver-disk',
                    namespace: 'vm-cloning-demo',
                  },
                },
                storage: {
                  accessModes: ['ReadWriteOnce'],
                  resources: {
                    requests: {
                      storage: '30Gi',
                    },
                  },
                },
              },
            } as never,
          });
          onResult({
            status: 'success',
            message: t('DataVolume "{{name}}" created to clone source VM PVC', {
              name: dvName,
            }),
          });
          break;
        }
        case 'create-clone-vm': {
          const vmName = 'webserver-clone-2';
          await k8sCreate({
            model: VirtualMachineModel,
            ns: 'vm-cloning-demo',
            data: {
              apiVersion: 'kubevirt.io/v1',
              kind: 'VirtualMachine',
              metadata: {
                name: vmName,
                namespace: 'vm-cloning-demo',
                labels: {
                  [MANAGED_BY]: MANAGED_BY_VALUE,
                },
              },
              spec: {
                runStrategy: 'Manual',
                template: {
                  metadata: {
                    labels: { 'kubevirt.io/domain': vmName },
                  },
                  spec: {
                    domain: {
                      cpu: { cores: 2 },
                      devices: {
                        disks: [{ disk: { bus: 'virtio' }, name: 'rootdisk' }],
                        interfaces: [{ masquerade: {}, name: 'default' }],
                        rng: {},
                      },
                      memory: { guest: '4Gi' },
                    },
                    networks: [{ name: 'default', pod: {} }],
                    volumes: [
                      {
                        name: 'rootdisk',
                        persistentVolumeClaim: {
                          claimName: 'webserver-clone-2-disk',
                        },
                      },
                    ],
                  },
                },
              },
            } as never,
          });
          onResult({
            status: 'success',
            message: t(
              'VM "{{name}}" created from cloned PVC (Manual — use virtctl start to boot)',
              { name: vmName },
            ),
          });
          break;
        }
        case 'cleanup-cloning-demo': {
          const vms = await k8sListItems({
            model: VirtualMachineModel,
            queryParams: { ns: 'vm-cloning-demo' },
          });
          const dvs = await k8sListItems({
            model: DataVolumeModel,
            queryParams: { ns: 'vm-cloning-demo' },
          });
          onResult({
            status: 'success',
            message: t(
              'Found {{vmCount}} VMs and {{dvCount}} DataVolumes in vm-cloning-demo. Delete namespace to remove all resources.',
              { vmCount: vms.length, dvCount: dvs.length },
            ),
          });
          break;
        }
        default:
          onResult({
            status: 'error',
            message: t('This command must be run manually in a terminal.'),
          });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onResult({ status: 'error', message: msg });
    }
  }, [action, namespace, needsProject, onResult, t]);

  const runButton = (
    <Button
      variant="link"
      onClick={() => void handleRun()}
      isDisabled={result.status === 'running' || needsProject}
      isLoading={result.status === 'running'}
      data-test="run-command"
    >
      {t('Run')}
    </Button>
  );

  return (
    <div className="partner-labs-console-plugin__command-block">
      <CodeBlock
        actions={
          <>
            <CodeBlockAction>
              {/* PF6 still requires the deprecated textId for associating copied content. */}
              {/* eslint-disable @typescript-eslint/no-deprecated */}
              <ClipboardCopyButton
                id={copyId}
                textId={`${copyId}-text`}
                exitDelay={2000}
                onTooltipHidden={() => {
                  setCopied(false);
                }}
                onClick={() => {
                  void navigator.clipboard.writeText(command).then(
                    () => {
                      setCopied(true);
                    },
                    () => {
                      setCopied(false);
                    },
                  );
                }}
                data-test="copy-command"
              >
                {copied ? t('Copied') : t('Copy command')}
              </ClipboardCopyButton>
              {/* eslint-enable @typescript-eslint/no-deprecated */}
            </CodeBlockAction>
            {action && placeholders.length === 0 && (
              <CodeBlockAction>
                {needsProject ? (
                  <Tooltip content={t('Select a project first')}>
                    <span>{runButton}</span>
                  </Tooltip>
                ) : (
                  runButton
                )}
              </CodeBlockAction>
            )}
          </>
        }
      >
        <CodeBlockCode id={`${copyId}-text`}>{command}</CodeBlockCode>
      </CodeBlock>
      {needsProject && <Label isCompact>{t('Select a project first')}</Label>}
      {placeholders.length > 0 && (
        <Tooltip content={t('Replace placeholders: {{names}}', { names: placeholders.join(', ') })}>
          <Label isCompact>{t('Edit before running')}</Label>
        </Tooltip>
      )}
      {result.status !== 'idle' && result.message && (
        <Label
          status={
            result.status === 'error' ? 'danger' : result.status === 'success' ? 'success' : 'info'
          }
          className="partner-labs-console-plugin__command-result"
        >
          {result.message}
        </Label>
      )}
      {result.detail && (
        <ExpandableSection
          isExpanded={outputExpanded}
          onToggle={(_event, expanded) => {
            setOutputExpanded(expanded);
          }}
          toggleText={t('Output')}
          data-test="command-output"
        >
          <div className="partner-labs-console-plugin__command-detail">
            <CodeBlock>
              <CodeBlockCode>{result.detail}</CodeBlockCode>
            </CodeBlock>
          </div>
        </ExpandableSection>
      )}
    </div>
  );
};
