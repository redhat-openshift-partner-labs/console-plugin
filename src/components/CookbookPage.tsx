import {
  DocumentTitle,
  k8sCreate,
  k8sGet,
  k8sListItems,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  ClipboardCopy,
  CodeBlock,
  CodeBlockCode,
  Content,
  PageSection,
  Split,
  SplitItem,
  Title,
} from '@patternfly/react-core';
import { CheckCircleIcon, PlayIcon, TimesCircleIcon } from '@patternfly/react-icons';
import { useCallback, useState, type FC } from 'react';
import { Link, useParams } from 'react-router';
import * as cardsData from '../cards.yaml';
import type { CookbookSection } from '../types/cookbook';

import './cookbook.css';

interface DemoCard {
  id: string;
  title: string;
  body: string;
  cookbook: CookbookSection[];
}

const cards = (Array.isArray(cardsData) ? cardsData : (cardsData as { default: DemoCard[] }).default) as DemoCard[];

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

type CommandStatus = 'idle' | 'running' | 'success' | 'error';

interface CommandResult {
  status: CommandStatus;
  message?: string;
  detail?: string;
}

const StatusIcon: FC<{ status: CommandStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <span className="partner-labs-console-plugin__spinner" />;
    case 'success':
      return <CheckCircleIcon className="partner-labs-console-plugin__status-success" />;
    case 'error':
      return <TimesCircleIcon className="partner-labs-console-plugin__status-error" />;
    default:
      return null;
  }
};

const CommandBlock: FC<{
  command: string;
  action?: string;
  namespace: string;
  onResult: (result: CommandResult) => void;
  result: CommandResult;
}> = ({ command, action, namespace, onResult, result }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');

  const handleRun = useCallback(async () => {
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
            const conditions = ((ds as Record<string, unknown>).status as Record<string, unknown[]>)?.conditions ?? [];
            const ready = (conditions as Array<{ type: string; status: string }>).find((c) => c.type === 'Ready');
            const sourceStatus = ready?.status === 'True' ? 'Ready' : 'Not Ready';
            const created = ds.metadata?.creationTimestamp
              ? new Date(ds.metadata.creationTimestamp).toLocaleDateString()
              : '';
            return `${name} ${sourceStatus.padEnd(15)} ${created}`;
          });
          onResult({
            status: 'success',
            message: t('Found {{count}} DataSources in openshift-virtualization-os-images', { count: items.length }),
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
          const yaml = JSON.parse(JSON.stringify(template));
          delete yaml.metadata?.managedFields;
          onResult({
            status: 'success',
            message: t('Template "{{name}}" in namespace "openshift"', { name: template.metadata?.name }),
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
                  'app.kubernetes.io/managed-by': 'partner-labs-console-plugin',
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
            message: t('VM "{{name}}" created in namespace "{{ns}}"', { name: vmName, ns: namespace }),
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
            const desc = ((tpl.metadata?.annotations ?? {}) as Record<string, string>)['description'] ?? '';
            const truncated = desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
            return `${name} ${truncated}`;
          });
          onResult({
            status: 'success',
            message: t('Found {{count}} VM templates in openshift namespace', { count: vmTemplates.length }),
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
          const cleaned = JSON.parse(JSON.stringify(template));
          delete cleaned.metadata?.managedFields;
          onResult({
            status: 'success',
            message: t('Template "{{name}}" in namespace "openshift"', { name: template.metadata?.name }),
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
                  'app.kubernetes.io/managed-by': 'partner-labs-console-plugin',
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
                          userData: '#cloud-config\nuser: cloud-user\npassword: demo-pass\nchpasswd:\n  expire: false\n',
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
            message: t('VM "{{name}}" created in namespace "template-example" (Halted — use virtctl start to boot)', { name: vmName }),
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
            const status = (((vm as Record<string, unknown>).status as Record<string, unknown>)?.printableStatus as string) ?? 'Unknown';
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
                  description: 'Custom RHEL 9 template with auto-start and configurable cloud-init user',
                  'iconClass': 'icon-rhel',
                  'openshift.io/display-name': 'RHEL 9 Custom VM',
                  'openshift.io/provider-display-name': 'Partner Labs',
                  'tags': 'kubevirt,virtualmachine,linux,rhel',
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
                              userData: '#cloud-config\nuser: ${CLOUD_INIT_USERNAME}\npassword: ${CLOUD_INIT_PASSWORD}\nchpasswd:\n  expire: false\n',
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
                { description: 'VM name', from: 'rhel9-custom-[a-z0-9]{6}', generate: 'expression', name: 'NAME' },
                { description: 'Name of the DataSource to clone', name: 'DATA_SOURCE_NAME', value: 'rhel9' },
                { description: 'Namespace of the DataSource', name: 'DATA_SOURCE_NAMESPACE', value: 'openshift-virtualization-os-images' },
                { description: 'Cloud-init username', name: 'CLOUD_INIT_USERNAME', value: 'shadowman' },
                { description: 'Cloud-init password', from: '[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}', generate: 'expression', name: 'CLOUD_INIT_PASSWORD' },
              ],
            } as never,
          });
          onResult({
            status: 'success',
            message: t('Custom template "rhel9-custom" created in namespace "{{ns}}"', { ns: namespace }),
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
            const status = (((vm as Record<string, unknown>).status as Record<string, unknown>)?.printableStatus as string) ?? 'Unknown';
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
        default:
          onResult({ status: 'error', message: t('This command must be run manually in a terminal.') });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onResult({ status: 'error', message: msg });
    }
  }, [action, namespace, onResult, t]);

  return (
    <div className="partner-labs-console-plugin__command-block">
      <Split hasGutter>
        <SplitItem isFilled>
          <ClipboardCopy isReadOnly variant="expansion">
            {command}
          </ClipboardCopy>
        </SplitItem>
        {action && (
          <SplitItem>
            <Button
              variant="secondary"
              icon={<PlayIcon />}
              onClick={handleRun}
              isDisabled={result.status === 'running'}
              isLoading={result.status === 'running'}
            >
              {t('Run')}
            </Button>
          </SplitItem>
        )}
      </Split>
      {result.status !== 'idle' && result.message && (
        <Alert
          variant={result.status === 'error' ? 'danger' : result.status === 'success' ? 'success' : 'info'}
          isInline
          isPlain
          title={result.message}
          className="partner-labs-console-plugin__command-result"
        >
          <StatusIcon status={result.status} />
        </Alert>
      )}
      {result.detail && (
        <div className="partner-labs-console-plugin__command-detail">
          <CodeBlock>
            <CodeBlockCode>{result.detail}</CodeBlockCode>
          </CodeBlock>
        </div>
      )}
    </div>
  );
};

const CookbookPage: FC = () => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const { demoId } = useParams();
  const [activeNamespace] = useActiveNamespace();
  const [results, setResults] = useState<Record<string, CommandResult>>({});

  const card = cards.find((c) => c.id === demoId);

  const setCommandResult = useCallback((commandId: string) => {
    return (result: CommandResult) => {
      setResults((prev) => ({ ...prev, [commandId]: result }));
    };
  }, []);

  if (!card) {
    return (
      <PageSection>
        <Alert variant="warning" title={t('Demo not found')} />
      </PageSection>
    );
  }

  return (
    <>
      <DocumentTitle>{card.title}</DocumentTitle>
      <PageSection>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to="/partner-labs-demos">{t('Partner Labs Demos')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{card.title}</BreadcrumbItem>
        </Breadcrumb>
      </PageSection>
      <PageSection>
        <Title headingLevel="h1" size="2xl" className="partner-labs-console-plugin__cookbook-title">
          {card.title}
        </Title>
        <Content component="p" className="partner-labs-console-plugin__namespace-info">
          {t('Active namespace: {{ns}}', { ns: activeNamespace })}
        </Content>

        {card.cookbook.map((section, sectionIdx) => (
          <div key={sectionIdx} className="partner-labs-console-plugin__cookbook-section">
            <Title headingLevel={section.level === 2 ? 'h2' : 'h3'} size={section.level === 2 ? 'xl' : 'lg'}>
              {t(section.heading)}
            </Title>

            {section.content.map((block, blockIdx) => {
              const key = `${sectionIdx}-${blockIdx}`;
              if (block.type === 'text') {
                return (
                  <Content component="p" key={key}>
                    {block.value}
                  </Content>
                );
              }
              if (block.type === 'steps') {
                return (
                  <Content component="ol" key={key}>
                    {block.items.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </Content>
                );
              }
              if (block.type === 'command') {
                return (
                  <CommandBlock
                    key={key}
                    command={block.value}
                    action={block.action}
                    namespace={activeNamespace}
                    result={results[key] ?? { status: 'idle' }}
                    onResult={setCommandResult(key)}
                  />
                );
              }
              if (block.type === 'note') {
                return (
                  <Alert
                    key={key}
                    variant={block.variant === 'warning' ? 'warning' : 'info'}
                    isInline
                    title={block.value}
                    className="partner-labs-console-plugin__cookbook-note"
                  />
                );
              }
              return null;
            })}
          </div>
        ))}
      </PageSection>
    </>
  );
};

export default CookbookPage;
