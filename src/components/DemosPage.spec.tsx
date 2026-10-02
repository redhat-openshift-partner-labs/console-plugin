import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';

let mockNamespace = 'demo';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => {
  const setActiveQuickStart = jest.fn();
  return {
    DocumentTitle: ({ children }: { children: React.ReactNode }) => <title>{children}</title>,
    ListPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
    NamespaceBar: ({ isDisabled }: { isDisabled?: boolean }) => (
      <select
        aria-label="Project"
        value={mockNamespace}
        disabled={isDisabled}
        onChange={(event) => {
          mockNamespace = event.target.value;
        }}
      >
        {['#ALL_NS#', 'demo', 'other'].map((project) => (
          <option key={project} value={project}>
            {project}
          </option>
        ))}
      </select>
    ),
    useActiveNamespace: () => [mockNamespace],
    useK8sWatchResources: jest.fn(() => ({})),
    useK8sModel: () => [undefined, false],
    useListPageFilter: (data: unknown[]) => [data, data, jest.fn()],
    ListPageFilter: () => null,
    VirtualizedTable: () => null,
    useQuickStartContext: () => ({ setActiveQuickStart }),
    k8sCreate: jest.fn().mockResolvedValue({}),
    k8sGet: jest.fn().mockRejectedValue({ code: 404 }),
    setActiveQuickStart,
  };
});

import DemosPage from './DemosPage';

const sdk = jest.requireMock<{
  k8sCreate: jest.Mock<
    Promise<unknown>,
    [
      {
        ns: string;
        data: {
          kind: string;
          metadata: { name: string; namespace: string; labels: Record<string, string> };
          spec: { pipelineSpec: unknown; taskRunTemplate: { serviceAccountName: string } };
        };
      },
    ]
  >;
  setActiveQuickStart: jest.Mock;
  k8sGet: jest.Mock;
}>('@openshift-console/dynamic-plugin-sdk');

beforeEach(() => {
  jest.clearAllMocks();
  mockNamespace = 'demo';
  sdk.k8sCreate.mockResolvedValue({});
  sdk.k8sGet.mockRejectedValue({ code: 404 });
});

describe('DemosPage', () => {
  it('shows the three interaction types and the cookbook pages', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(9);
    expect(screen.getByText('Custom Page')).toBeInTheDocument();
    expect(screen.getByText('How-to Use Demos')).toBeInTheDocument();
    expect(screen.getByText('Creating Virtual Machines')).toBeInTheDocument();
    expect(screen.getByText('Custom VM Templates')).toBeInTheDocument();
    expect(screen.getByText('VM Instancetypes & Preferences')).toBeInTheDocument();
    expect(screen.getByText('Install and configure OpenShift Virtualization')).toBeInTheDocument();
    expect(screen.getByText('Create a VM from the web console')).toBeInTheDocument();
    expect(screen.getByText('Create custom VM templates')).toBeInTheDocument();
    expect(screen.getByText('Tekton Pipeline')).toBeInTheDocument();
  });

  it('opens the page route', async () => {
    render(
      <MemoryRouter initialEntries={['/partner-labs-demos']}>
        <Switch>
          <Route exact path="/partner-labs-demos" component={DemosPage} />
          <Route path="/partner-labs-example" render={() => <div data-test="example-route" />} />
        </Switch>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-page'));
    expect(await screen.findByTestId('example-route')).toBeInTheDocument();
  });

  it.each([
    ['vm-instancetypes-and-preferences', 'vm-instancetypes-and-preferences'],
    ['install-configure-ocpv-operator', 'install-configure-ocpv-operator'],
    ['create-vm-web-console', 'create-vm-web-console'],
    ['vm-templates', 'vm-templates'],
  ])('starts the ConsoleQuickStart from the %s card', (cardId, quickStartId) => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId(`card-action-${cardId}`));
    expect(sdk.setActiveQuickStart).toHaveBeenCalledWith(quickStartId);
  });

  it('creates an inline Tekton PipelineRun', async () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    await waitFor(() => {
      expect(sdk.k8sCreate).toHaveBeenCalledTimes(1);
    });
    const request = sdk.k8sCreate.mock.calls[0][0];
    expect(request.ns).toBe('demo');
    expect(request.data.kind).toBe('PipelineRun');
    expect(request.data.spec.pipelineSpec).toBeDefined();
    expect(request.data.spec.taskRunTemplate.serviceAccountName).toBe('default');
    expect(request.data.metadata.name).toBe('partner-labs-demo');
    expect(request.data.metadata.labels).toEqual({
      'app.kubernetes.io/managed-by': 'partner-labs-console-plugin',
    });
    expect(screen.getByTestId('toast-pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('activity-tab')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-catalog'));
    expect(screen.getByText('View run')).toBeInTheDocument();
  });

  it('opens Activity without creating another run when the card run exists', async () => {
    sdk.k8sGet.mockResolvedValue({
      metadata: {
        name: 'partner-labs-demo',
        labels: { 'app.kubernetes.io/managed-by': 'partner-labs-console-plugin' },
      },
    });
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    expect(await screen.findByTestId('activity-tab')).toBeInTheDocument();
    expect(sdk.k8sCreate).not.toHaveBeenCalled();
  });

  it('allows a new run after the tracked run is deleted', async () => {
    sdk.k8sGet
      .mockResolvedValueOnce({
        metadata: {
          name: 'partner-labs-demo',
          labels: { 'app.kubernetes.io/managed-by': 'partner-labs-console-plugin' },
        },
      })
      .mockRejectedValueOnce({ code: 404 });
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    await screen.findByTestId('activity-tab');
    fireEvent.click(screen.getByTestId('tab-catalog'));
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    await waitFor(() => {
      expect(sdk.k8sCreate).toHaveBeenCalledTimes(1);
    });
  });

  it('filters by title and body, then clears the empty result', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    const search = screen.getByRole('textbox', { name: 'Search demos' });
    fireEvent.change(search, { target: { value: 'guided walkthrough' } });
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(3);
    expect(screen.getByText('VM Instancetypes & Preferences')).toBeInTheDocument();
    expect(screen.getByText('Create a VM from the web console')).toBeInTheDocument();
    expect(screen.getByText('Create custom VM templates')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'no matching demo' } });
    expect(screen.getByText('No demos match your filters')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-filters'));
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(9);
  });

  it('filters by kind and displays each action in the footer', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cookbook' }));
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(2);
    expect(screen.getAllByText('Open cookbook')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Run in {{namespace}}')).toBeInTheDocument();
  });

  it('disables the pipeline card while creation is pending', () => {
    sdk.k8sCreate.mockImplementation(() => new Promise(() => undefined));
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    expect(screen.getByTestId('card-action-pipeline')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Project' })).toBeDisabled();
    expect(screen.getByText('Creating…')).toBeInTheDocument();
  });

  it('links to the namespace where the run was created', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/partner-labs-demos']}>
        <Route exact path="/partner-labs-demos" component={DemosPage} />
        <Route
          path="/k8s/ns/:namespace/:resource/:name"
          render={({ match }) => <span data-test="run-detail">{match.params.namespace}</span>}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    await screen.findByTestId('toast-pipeline');
    mockNamespace = 'other';
    rerender(
      <MemoryRouter initialEntries={['/partner-labs-demos']}>
        <Route exact path="/partner-labs-demos" component={DemosPage} />
        <Route
          path="/k8s/ns/:namespace/:resource/:name"
          render={({ match }) => <span data-test="run-detail">{match.params.namespace}</span>}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('view-pipeline-run'));
    expect(await screen.findByTestId('run-detail')).toHaveTextContent('demo');
  });

  it('disables the pipeline in All projects', () => {
    mockNamespace = '#ALL_NS#';
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('card-action-pipeline')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Project' })).toBeEnabled();
    expect(screen.getByText('Select a project to run')).toBeInTheDocument();
    expect(sdk.k8sGet).not.toHaveBeenCalled();
  });

  it('runs the pipeline in the project selected on the demos page', async () => {
    mockNamespace = '#ALL_NS#';
    const page = (
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>
    );
    const { rerender } = render(page);
    fireEvent.change(screen.getByRole('combobox', { name: 'Project' }), {
      target: { value: 'other' },
    });
    // Console updates subscribers to useActiveNamespace after a project change.
    rerender(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('card-action-pipeline')).toBeEnabled();
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    await screen.findByTestId('toast-pipeline');
    expect(sdk.k8sGet).toHaveBeenCalledWith(
      expect.objectContaining({ ns: 'other', name: 'partner-labs-demo' }),
    );
    const request = sdk.k8sCreate.mock.calls[0][0];
    expect(request.ns).toBe('other');
    expect(request.data.metadata.namespace).toBe('other');
    expect(screen.getByRole('combobox', { name: 'Project' })).toBeEnabled();
  });

  it('shows View run when the fixed run exists', async () => {
    sdk.k8sGet.mockResolvedValue({
      metadata: {
        name: 'partner-labs-demo',
        labels: { 'app.kubernetes.io/managed-by': 'partner-labs-console-plugin' },
      },
    });
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    expect(await screen.findByText('PipelineRun already exists')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-catalog'));
    expect(screen.getByText('View run')).toBeInTheDocument();
  });

  it('closes the creation error toast', async () => {
    sdk.k8sGet.mockRejectedValue({ code: 403 });
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('card-action-pipeline'));
    expect(await screen.findByTestId('toast-create-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close Danger alert/ }));
    expect(screen.queryByTestId('toast-create-error')).not.toBeInTheDocument();
  });
});
