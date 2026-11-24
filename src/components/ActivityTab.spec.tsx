import { fireEvent, render, screen } from '@testing-library/react';
import type { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

interface WatchResult {
  data: K8sResourceCommon[];
  loaded: boolean;
  loadError?: unknown;
}

let mockAvailable = { VirtualMachine: true, PipelineRun: true };
let mockWatchResults: { vms?: WatchResult; runs?: WatchResult } = {};
const mockOpenDeleteModal = jest.fn();
const rowComponents: React.ComponentType<{
  obj: { resource: K8sResourceCommon; kind: string };
  activeColumnIDs: Set<string>;
}>[] = [];

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sModel: ({ kind }: { kind: 'VirtualMachine' | 'PipelineRun' }) => [
    mockAvailable[kind] ? { kind } : undefined,
    false,
  ],
  useK8sWatchResources: jest.fn(() => mockWatchResults),
  useDeleteModal: jest.fn(() => mockOpenDeleteModal),
  TableData: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResourceLink: ({ name }: { name: string }) => <span>{name}</span>,
  Timestamp: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
  useListPageFilter: jest.fn((data: K8sResourceCommon[]) => [data, data, jest.fn()]),
  ListPageFilter: () => <div data-test="activity-filter" />,
  VirtualizedTable: ({
    data,
    NoDataEmptyMsg,
    Row,
  }: {
    data: { resource: K8sResourceCommon; kind: string }[];
    NoDataEmptyMsg: () => React.ReactElement;
    Row: React.FC<{
      obj: { resource: K8sResourceCommon; kind: string };
      activeColumnIDs: Set<string>;
    }>;
  }) => {
    rowComponents.push(Row);
    return data.length ? (
      <div>
        {data.map((obj) => (
          <div key={obj.resource.metadata?.name}>
            <Row obj={obj} activeColumnIDs={new Set(['actions'])} />
          </div>
        ))}
      </div>
    ) : (
      <NoDataEmptyMsg />
    );
  },
}));

import ActivityTab from './ActivityTab';

const sdk = jest.requireMock<{
  useK8sWatchResources: jest.Mock;
  useListPageFilter: jest.Mock;
  useDeleteModal: jest.Mock;
}>('@openshift-console/dynamic-plugin-sdk');

beforeEach(() => {
  mockAvailable = { VirtualMachine: true, PipelineRun: true };
  mockWatchResults = {};
  jest.clearAllMocks();
  rowComponents.length = 0;
});

describe('ActivityTab', () => {
  it('watches labeled resources in the active namespace and combines both kinds', () => {
    mockWatchResults = {
      vms: { data: [{ metadata: { name: 'demo-vm', namespace: 'demo' } }], loaded: true },
      runs: { data: [{ metadata: { name: 'demo-run', namespace: 'demo' } }], loaded: true },
    };
    render(<ActivityTab namespace="demo" />);
    expect(screen.getByText('demo-vm')).toBeInTheDocument();
    expect(screen.getByText('demo-run')).toBeInTheDocument();
    const calls = sdk.useK8sWatchResources.mock.calls as unknown[][];
    const watches = calls[0][0] as Record<
      string,
      { namespace: string; selector: { matchLabels: Record<string, string> } }
    >;
    expect(watches.vms.namespace).toBe('demo');
    expect(watches.runs.selector.matchLabels).toEqual({
      'app.kubernetes.io/managed-by': 'partner-labs-console-plugin',
    });
  });

  it('offers a kind filter', () => {
    render(<ActivityTab namespace="demo" />);
    const calls = sdk.useListPageFilter.mock.calls as unknown[][];
    const rowFilters = calls[0][1] as {
      filter: (value: { selected: string[] }, row: { kind: string }) => boolean;
    }[];
    expect(rowFilters[0].filter({ selected: ['PipelineRun'] }, { kind: 'PipelineRun' })).toBe(true);
    expect(rowFilters[0].filter({ selected: ['PipelineRun'] }, { kind: 'VirtualMachine' })).toBe(
      false,
    );
  });

  it('shows an empty state when no labeled resources exist', () => {
    render(<ActivityTab namespace="demo" />);
    expect(screen.getByText('Resources you create from Demos appear here.')).toBeInTheDocument();
  });

  it('skips missing CRDs', () => {
    mockAvailable = { VirtualMachine: false, PipelineRun: true };
    render(<ActivityTab namespace="demo" />);
    const calls = sdk.useK8sWatchResources.mock.calls as unknown[][];
    const watches = calls[0][0] as Record<string, unknown>;
    expect(watches).not.toHaveProperty('vms');
    expect(watches).toHaveProperty('runs');
  });

  it('skips the PipelineRun watch when Pipelines is missing', () => {
    mockAvailable = { VirtualMachine: true, PipelineRun: false };
    render(<ActivityTab namespace="demo" />);
    const calls = sdk.useK8sWatchResources.mock.calls as unknown[][];
    const watches = calls[0][0] as Record<string, unknown>;
    expect(watches).toHaveProperty('vms');
    expect(watches).not.toHaveProperty('runs');
  });

  it('skips all watches in All projects', () => {
    render(<ActivityTab namespace="#ALL_NS#" />);
    const calls = sdk.useK8sWatchResources.mock.calls as unknown[][];
    expect(calls[0][0]).toEqual({});
    expect(screen.getByText('Select a project to see activity')).toBeInTheDocument();
  });

  it('explains when both operators are missing', () => {
    mockAvailable = { VirtualMachine: false, PipelineRun: false };
    render(<ActivityTab namespace="demo" />);
    expect(
      screen.getByText('OpenShift Pipelines and OpenShift Virtualization are not installed'),
    ).toBeInTheDocument();
  });

  it('keeps the same row component across watch updates', () => {
    mockWatchResults = {
      runs: { data: [{ metadata: { name: 'demo-run', namespace: 'demo' } }], loaded: true },
    };
    const { rerender } = render(<ActivityTab namespace="demo" />);
    mockWatchResults = {
      runs: {
        data: [
          {
            metadata: {
              name: 'demo-run',
              namespace: 'demo',
              creationTimestamp: '2026-09-24T00:00:00Z',
            },
          },
        ],
        loaded: true,
      },
    };
    rerender(<ActivityTab namespace="demo" />);
    expect(rowComponents[1]).toBe(rowComponents[0]);
  });

  it('offers a delete confirmation for PipelineRuns only', () => {
    mockWatchResults = {
      vms: { data: [{ metadata: { name: 'demo-vm', namespace: 'demo' } }], loaded: true },
      runs: {
        data: [{ metadata: { name: 'partner-labs-demo', namespace: 'demo' } }],
        loaded: true,
      },
    };
    render(<ActivityTab namespace="demo" />);
    expect(screen.queryByTestId('delete-run-demo-vm')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('delete-run-partner-labs-demo'));
    expect(mockOpenDeleteModal).toHaveBeenCalledTimes(1);
    const calls = sdk.useDeleteModal.mock.calls as [{ metadata?: { name?: string } }][];
    expect(calls.some(([resource]) => resource.metadata?.name === 'partner-labs-demo')).toBe(true);
  });
});
