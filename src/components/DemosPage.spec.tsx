import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cards } from '../data/cards';
import { getTopics, TOPIC_IDS } from '../data/topics';

let mockNamespace = 'demo';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => {
  const setActiveQuickStart = jest.fn();
  return {
    DocumentTitle: ({ children }: { children: React.ReactNode }) => <title>{children}</title>,
    ListPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
    NamespaceBar: () => (
      <select
        aria-label="Project"
        value={mockNamespace}
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
    setActiveQuickStart,
  };
});

import DemosPage from './DemosPage';

const sdk = jest.requireMock<{
  setActiveQuickStart: jest.Mock;
  useK8sWatchResources: jest.Mock;
}>('@openshift-console/dynamic-plugin-sdk');

beforeEach(() => {
  jest.clearAllMocks();
  mockNamespace = 'demo';
});

describe('DemosPage', () => {
  it('shows all demo cards', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(cards.length);
    expect(screen.getByText('Cloning Virtual Machines')).toBeInTheDocument();
    expect(screen.getByText('Cloud-init Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('VM Instancetypes & Preferences')).toBeInTheDocument();
    expect(screen.getByText('Using virtctl for VM management')).toBeInTheDocument();
    expect(screen.getByText('Configure multiple VM disks')).toBeInTheDocument();
    expect(screen.getByText('Install and configure OpenShift Virtualization')).toBeInTheDocument();
    expect(screen.getByText('Install the LVM Storage Operator')).toBeInTheDocument();
    expect(screen.getByText('Create a VM from the web console')).toBeInTheDocument();
    expect(screen.getByText('Create custom VM templates')).toBeInTheDocument();
    expect(screen.getByText('Understanding VM lifecycle states')).toBeInTheDocument();
  });

  it('mounts the Activity tab and its watches only when selected', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(sdk.useK8sWatchResources).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tab-activity'));
    expect(sdk.useK8sWatchResources).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tab-catalog'));
    const callsAfterLeavingActivity = sdk.useK8sWatchResources.mock.calls.length;
    fireEvent.click(screen.getByTestId('tab-activity'));
    expect(sdk.useK8sWatchResources.mock.calls.length).toBeGreaterThan(callsAfterLeavingActivity);
  });

  it.each(cards)('starts the ConsoleQuickStart from the $id card', ({ id, quickStartId }) => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId(`card-action-${id}`));
    expect(sdk.setActiveQuickStart).toHaveBeenCalledWith(quickStartId);
  });

  it('filters by title and body, then clears the empty result', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    const search = screen.getByRole('textbox', { name: 'Search demos' });
    fireEvent.change(search, { target: { value: 'guided walkthrough' } });
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(5);
    expect(screen.getByText('VM Instancetypes & Preferences')).toBeInTheDocument();
    expect(screen.getByText('Create a VM from the web console')).toBeInTheDocument();
    expect(screen.getByText('Create custom VM templates')).toBeInTheDocument();
    expect(screen.getByText('Cloning Virtual Machines')).toBeInTheDocument();
    expect(screen.getByText('Cloud-init Fundamentals')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'no matching demo' } });
    expect(screen.getByText('No demos match your filters')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-filters'));
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(cards.length);
  });

  it('filters by topic and displays each action in the footer', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Start walkthrough')).toHaveLength(cards.length);
    // Without an i18n instance, t() returns the key, so the duration pill shows the raw key.
    expect(screen.getByTestId('card-vm-export-import')).toHaveTextContent('{{minutes}} min');
    const topics = getTopics((key) => key);
    for (const topic of TOPIC_IDS) {
      fireEvent.click(screen.getByRole('button', { name: topics[topic].label }));
      const expected = cards.filter((card) => card.topic === topic);
      expect(expected.length).toBeGreaterThan(0);
      expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(expected.length);
      for (const card of expected)
        expect(screen.getByTestId(`card-${card.id}`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(cards.length);
  });
});
