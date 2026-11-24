import {
  ListPageFilter,
  ResourceLink,
  TableData,
  Timestamp,
  useK8sModel,
  useK8sWatchResources,
  useListPageFilter,
  useDeleteModal,
  VirtualizedTable,
  type K8sResourceCommon,
} from '@openshift-console/dynamic-plugin-sdk';
import { Button, EmptyState, EmptyStateBody, Label } from '@patternfly/react-core';
import { useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MANAGED_BY, MANAGED_BY_VALUE } from '../data/labels';
import { ALL_NAMESPACES_KEY } from '../data/namespace';
import { getRunStatus } from '../data/pipelineRun';

const VM_KIND = { group: 'kubevirt.io', version: 'v1', kind: 'VirtualMachine' };
const RUN_KIND = { group: 'tekton.dev', version: 'v1', kind: 'PipelineRun' };

interface ActivityRow extends K8sResourceCommon {
  resource: K8sResourceCommon;
  kind: 'VirtualMachine' | 'PipelineRun';
}

interface WatchResult {
  data: K8sResourceCommon[];
  loaded: boolean;
  loadError: unknown;
}

const Row: FC<{ obj: ActivityRow; activeColumnIDs: Set<string> }> = ({ obj, activeColumnIDs }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const { resource, kind } = obj;
  const openDeleteModal = useDeleteModal(resource);
  const vmStatus = (resource as { status?: { printableStatus?: string } }).status?.printableStatus;
  let statusText: string;
  let labelStatus: 'success' | 'danger' | 'info' = 'info';
  if (kind === 'PipelineRun') {
    const status = getRunStatus(resource);
    statusText =
      status === 'succeeded' ? t('Succeeded') : status === 'failed' ? t('Failed') : t('Running');
    labelStatus = status === 'succeeded' ? 'success' : status === 'failed' ? 'danger' : 'info';
  } else {
    switch (vmStatus) {
      case 'Running':
        statusText = t('Running');
        labelStatus = 'success';
        break;
      case 'Stopped':
        statusText = t('Stopped');
        break;
      case 'Starting':
        statusText = t('Starting');
        break;
      case 'Stopping':
        statusText = t('Stopping');
        break;
      case 'Provisioning':
        statusText = t('Provisioning');
        break;
      case 'Paused':
        statusText = t('Paused');
        break;
      case 'Migrating':
        statusText = t('Migrating');
        break;
      case 'Terminating':
        statusText = t('Terminating');
        break;
      case 'WaitingForVolumeBinding':
        statusText = t('Waiting for volume binding');
        break;
      case 'ErrorUnschedulable':
        statusText = t('Error: unschedulable');
        labelStatus = 'danger';
        break;
      case 'CrashLoopBackOff':
        statusText = t('Crash loop back-off');
        labelStatus = 'danger';
        break;
      default:
        statusText = t('Unknown');
    }
  }
  return (
    <>
      <TableData id="name" activeColumnIDs={activeColumnIDs}>
        <ResourceLink
          groupVersionKind={kind === 'PipelineRun' ? RUN_KIND : VM_KIND}
          name={resource.metadata?.name}
          namespace={resource.metadata?.namespace}
        />
      </TableData>
      <TableData id="kind" activeColumnIDs={activeColumnIDs}>
        {kind === 'PipelineRun' ? t('PipelineRun') : t('VirtualMachine')}
      </TableData>
      <TableData id="status" activeColumnIDs={activeColumnIDs}>
        <Label status={labelStatus}>{statusText}</Label>
      </TableData>
      <TableData id="created" activeColumnIDs={activeColumnIDs}>
        {resource.metadata?.creationTimestamp && (
          <Timestamp timestamp={resource.metadata.creationTimestamp} />
        )}
      </TableData>
      <TableData id="actions" activeColumnIDs={activeColumnIDs}>
        {kind === 'PipelineRun' && (
          <Button
            variant="link"
            isDanger
            onClick={openDeleteModal}
            data-test={`delete-run-${resource.metadata?.name ?? ''}`}
          >
            {t('Delete PipelineRun')}
          </Button>
        )}
      </TableData>
    </>
  );
};

const ActivityTab: FC<{ namespace: string }> = ({ namespace }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const [vmModel, vmModelLoading] = useK8sModel(VM_KIND);
  const [runModel, runModelLoading] = useK8sModel(RUN_KIND);
  const vmKind = (vmModel as { kind?: string } | undefined)?.kind;
  const runKind = (runModel as { kind?: string } | undefined)?.kind;
  const watches = useMemo(() => {
    const selector = { matchLabels: { [MANAGED_BY]: MANAGED_BY_VALUE } };
    return {
      ...(namespace !== ALL_NAMESPACES_KEY && vmKind === 'VirtualMachine'
        ? { vms: { groupVersionKind: VM_KIND, namespace, isList: true, selector, optional: true } }
        : {}),
      ...(namespace !== ALL_NAMESPACES_KEY && runKind === 'PipelineRun'
        ? {
            runs: { groupVersionKind: RUN_KIND, namespace, isList: true, selector, optional: true },
          }
        : {}),
    };
  }, [namespace, vmKind, runKind]);
  const watched = useK8sWatchResources<Record<string, K8sResourceCommon[]>>(
    watches,
  ) as unknown as Partial<Record<'vms' | 'runs', WatchResult>>;
  const rows = useMemo<ActivityRow[]>(
    () => [
      ...(watched.vms?.data ?? []).map((resource) => ({
        ...resource,
        resource,
        kind: 'VirtualMachine' as const,
      })),
      ...(watched.runs?.data ?? []).map((resource) => ({
        ...resource,
        resource,
        kind: 'PipelineRun' as const,
      })),
    ],
    [watched.vms?.data, watched.runs?.data],
  );
  const rowFilters = useMemo(
    () => [
      {
        filterGroupName: t('Kind'),
        type: 'kind',
        items: [
          { id: 'VirtualMachine', title: t('VirtualMachine') },
          { id: 'PipelineRun', title: t('PipelineRun') },
        ],
        isMatch: (row: ActivityRow, id: string) => row.kind === id,
        filter: ({ selected }: { selected?: string[] }, row: ActivityRow) =>
          !selected?.length || selected.includes(row.kind),
      },
    ],
    [t],
  );
  // The SDK marks these supported list components as deprecated in its types.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const [staticData, filteredData, onFilterChange] = useListPageFilter<ActivityRow, ActivityRow>(
    rows,
    rowFilters,
  );
  const columns = useMemo(
    () => [
      { title: t('Name'), id: 'name' },
      { title: t('Kind'), id: 'kind' },
      { title: t('Status'), id: 'status' },
      { title: t('Created'), id: 'created' },
      { title: '', id: 'actions', props: { className: 'pf-v6-c-table__action' } },
    ],
    [t],
  );
  const loaded =
    !vmModelLoading &&
    !runModelLoading &&
    (!watched.vms || watched.vms.loaded) &&
    (!watched.runs || watched.runs.loaded);
  const loadError: unknown = watched.vms?.loadError ?? watched.runs?.loadError;
  const EmptyMessage = () => (
    <EmptyState titleText={t('No activity yet')} headingLevel="h2">
      <EmptyStateBody>{t('Resources you create from Demos appear here.')}</EmptyStateBody>
    </EmptyState>
  );
  if (namespace === ALL_NAMESPACES_KEY) {
    return (
      <div className="partner-labs-console-plugin__activity" data-test="activity-tab">
        <EmptyState titleText={t('Select a project to see activity')} headingLevel="h2" />
      </div>
    );
  }

  if (loaded && !vmKind && !runKind) {
    return (
      <div className="partner-labs-console-plugin__activity" data-test="activity-tab">
        <EmptyState
          titleText={t('OpenShift Pipelines and OpenShift Virtualization are not installed')}
          headingLevel="h2"
        />
      </div>
    );
  }

  return (
    <div className="partner-labs-console-plugin__activity" data-test="activity-tab">
      {/* eslint-disable-next-line @typescript-eslint/no-deprecated */}
      <ListPageFilter
        data={staticData}
        loaded={loaded}
        rowFilters={rowFilters}
        onFilterChange={onFilterChange}
        hideLabelFilter
        nameFilterPlaceholder={t('Search by name')}
      />
      {/* eslint-disable-next-line @typescript-eslint/no-deprecated */}
      <VirtualizedTable
        data={filteredData}
        unfilteredData={staticData}
        loaded={loaded}
        loadError={loadError}
        columns={columns}
        Row={Row}
        NoDataEmptyMsg={EmptyMessage}
        EmptyMsg={EmptyMessage}
        aria-label={t('Activity')}
      />
    </div>
  );
};

export default ActivityTab;
