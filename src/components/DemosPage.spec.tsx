import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  DocumentTitle: ({ children }: { children: React.ReactNode }) => <title>{children}</title>,
  ListPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  useActiveNamespace: () => ['default', jest.fn()],
  useK8sWatchResource: () => [undefined, false, undefined],
  useQuickStartContext: () => ({ setActiveQuickStart: jest.fn() }),
  k8sCreate: jest.fn(),
}));

import DemosPage from './DemosPage';

describe('DemosPage', () => {
  it('renders the page heading', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Partner Labs Demos' })).toBeInTheDocument();
  });

  it('renders demo cards from YAML data', () => {
    render(
      <MemoryRouter>
        <DemosPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Creating Virtual Machines')).toBeInTheDocument();
    expect(screen.getByText('Custom VM Templates')).toBeInTheDocument();
    expect(screen.getByText('Build & Deploy Pipeline')).toBeInTheDocument();
    expect(screen.getByText('VM Instancetypes & Preferences')).toBeInTheDocument();
  });
});
