import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cards } from '../data/cards';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => {
  const setActiveQuickStart = jest.fn();
  return {
    DocumentTitle: ({ children }: { children: React.ReactNode }) => <title>{children}</title>,
    ListPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
    useQuickStartContext: () => ({ setActiveQuickStart }),
    setActiveQuickStart,
  };
});

import DemosPage from './DemosPage';

const sdk = jest.requireMock<{ setActiveQuickStart: jest.Mock }>(
  '@openshift-console/dynamic-plugin-sdk',
);

beforeEach(() => {
  jest.clearAllMocks();
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
    expect(screen.getByText('No demos match your search')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-search'));
    expect(screen.getAllByTestId(/^card-(?!action)/)).toHaveLength(cards.length);
  });

  it('displays the walkthrough action in each card footer', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Start walkthrough')).toHaveLength(cards.length);
  });
});
