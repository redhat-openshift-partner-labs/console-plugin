import {
  DocumentTitle,
  k8sCreate,
  k8sGet,
  ListPageHeader,
  NamespaceBar,
  useActiveNamespace,
  useQuickStartContext,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertActionCloseButton,
  AlertActionLink,
  AlertGroup,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  Gallery,
  GalleryItem,
  Label,
  PageSection,
  SearchInput,
  Spinner,
  Tab,
  Tabs,
  TabTitleText,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';
import { cards, type DemoCard } from '../data/cards';
import { getKinds } from '../data/kinds';
import { MANAGED_BY, MANAGED_BY_VALUE } from '../data/labels';
import { ALL_NAMESPACES_KEY } from '../data/namespace';
import { CARD_PIPELINE_RUN_NAME, PipelineRunModel, pipelineRunPath } from '../data/pipelineRun';
import ActivityTab from './ActivityTab';
import RouterBridge from './RouterBridge';
import './demos.css';

const availableKinds = Array.from(new Set(cards.map((card) => card.kind)));

const DemosPageContent: FC = () => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const navigate = useNavigate();
  const [namespace] = useActiveNamespace();
  const kinds = getKinds(t, namespace);
  const { setActiveQuickStart } = useQuickStartContext();
  const [activeTab, setActiveTab] = useState<'catalog' | 'activity'>('catalog');
  const [query, setQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<DemoCard['kind'] | 'all'>('all');
  const [runName, setRunName] = useState<string>();
  const [runNamespace, setRunNamespace] = useState<string>();
  const [runAlreadyExists, setRunAlreadyExists] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [dismissedRun, setDismissedRun] = useState<string>();

  const busy = creating;
  const filteredCards = cards.filter((card) => {
    const matchesKind = selectedKind === 'all' || card.kind === selectedKind;
    const text = `${card.title} ${card.body}`.toLocaleLowerCase();
    return matchesKind && text.includes(query.trim().toLocaleLowerCase());
  });

  const startPipeline = async () => {
    if (busy || namespace === ALL_NAMESPACES_KEY) return;
    setCreating(true);
    setError(undefined);
    const name = CARD_PIPELINE_RUN_NAME;
    try {
      try {
        const existing = await k8sGet({ model: PipelineRunModel, name, ns: namespace });
        if (existing.metadata?.labels?.[MANAGED_BY] !== MANAGED_BY_VALUE) {
          throw new Error(
            t('A PipelineRun named {{name}} already exists in this namespace.', { name }),
          );
        }
        setRunNamespace(namespace);
        setRunName(name);
        setRunAlreadyExists(true);
        setDismissedRun(undefined);
        setActiveTab('activity');
        return;
      } catch (cause) {
        if (
          (cause as { code?: number; status?: number }).code !== 404 &&
          (cause as { code?: number; status?: number }).status !== 404
        ) {
          throw cause;
        }
      }
      await k8sCreate({
        model: PipelineRunModel,
        ns: namespace,
        data: {
          apiVersion: 'tekton.dev/v1',
          kind: 'PipelineRun',
          metadata: { name, namespace, labels: { [MANAGED_BY]: MANAGED_BY_VALUE } },
          spec: {
            taskRunTemplate: { serviceAccountName: 'default' },
            pipelineSpec: {
              tasks: [
                {
                  name: 'hello',
                  taskSpec: {
                    steps: [
                      {
                        name: 'hello',
                        image: 'registry.access.redhat.com/ubi9/ubi-minimal:latest',
                        command: ['/bin/sh', '-c'],
                        args: ['echo "Hello from the console plugin"'],
                      },
                    ],
                  },
                },
              ],
            },
          },
        } as never,
      });
      setDismissedRun(undefined);
      setRunNamespace(namespace);
      setRunName(name);
      setRunAlreadyExists(false);
      setActiveTab('activity');
    } catch (cause) {
      if (
        (cause as { code?: number; status?: number }).code === 409 ||
        (cause as { code?: number; status?: number }).status === 409
      ) {
        setRunNamespace(namespace);
        setRunName(name);
        setRunAlreadyExists(true);
        setDismissedRun(undefined);
        setActiveTab('activity');
      } else {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setCreating(false);
    }
  };

  const openCard = (card: DemoCard) => {
    switch (card.kind) {
      case 'page':
        navigate(card.path);
        break;
      case 'cookbook':
      case 'general':
        navigate(`/partner-labs-demos/${card.id}`);
        break;
      case 'quickstart':
        setActiveQuickStart?.(card.quickStartId);
        break;
      case 'pipeline':
        void startPipeline();
        break;
    }
  };

  return (
    <>
      <DocumentTitle>{t('Partner Labs Demos')}</DocumentTitle>
      <NamespaceBar isDisabled={creating} />
      <ListPageHeader title={t('Partner Labs Demos')} />
      <PageSection>
        <Tabs
          activeKey={activeTab}
          // Keep the hidden tab unmounted so the Activity watches close when Catalog is shown.
          unmountOnExit
          onSelect={(_event, key) => {
            setActiveTab(key as 'catalog' | 'activity');
          }}
        >
          <Tab
            eventKey="catalog"
            title={<TabTitleText>{t('Catalog')}</TabTitleText>}
            data-test="tab-catalog"
          >
            <Toolbar className="partner-labs-console-plugin__toolbar">
              <ToolbarContent>
                <ToolbarItem>
                  <SearchInput
                    aria-label={t('Search demos')}
                    placeholder={t('Search demos')}
                    value={query}
                    onChange={(_event, value) => {
                      setQuery(value);
                    }}
                    onClear={() => {
                      setQuery('');
                    }}
                    data-test="search-demos"
                  />
                </ToolbarItem>
                <ToolbarItem className="partner-labs-console-plugin__kind-scroll">
                  <ToggleGroup aria-label={t('Filter by kind')}>
                    <ToggleGroupItem
                      text={t('All')}
                      isSelected={selectedKind === 'all'}
                      onChange={() => {
                        setSelectedKind('all');
                      }}
                      data-test="kind-all"
                    />
                    {availableKinds.map((kind) => (
                      <ToggleGroupItem
                        key={kind}
                        text={kinds[kind].label}
                        isSelected={selectedKind === kind}
                        onChange={() => {
                          setSelectedKind(kind);
                        }}
                        data-test={`kind-${kind}`}
                      />
                    ))}
                  </ToggleGroup>
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>
            {filteredCards.length === 0 ? (
              <EmptyState titleText={t('No demos match your filters')} headingLevel="h2">
                <EmptyStateBody>{t('Try another search or kind.')}</EmptyStateBody>
                <EmptyStateActions>
                  <Button
                    variant="link"
                    onClick={() => {
                      setQuery('');
                      setSelectedKind('all');
                    }}
                    data-test="clear-filters"
                  >
                    {t('Clear filters')}
                  </Button>
                </EmptyStateActions>
              </EmptyState>
            ) : (
              <Gallery hasGutter minWidths={{ default: '300px' }}>
                {filteredCards.map((card) => {
                  const pipeline = card.kind === 'pipeline';
                  const cardBusy = pipeline && busy;
                  const action = kinds[card.kind].action;
                  return (
                    <GalleryItem key={card.id}>
                      <Card
                        isFullHeight
                        isClickable
                        isDisabled={cardBusy || (pipeline && namespace === ALL_NAMESPACES_KEY)}
                        data-test={`card-${card.id}`}
                      >
                        <CardHeader
                          selectableActions={{
                            onClickAction: () => {
                              openCard(card);
                            },
                            selectableActionId: `card-action-${card.id}`,
                            selectableActionAriaLabelledby: `card-title-${card.id}`,
                            selectableActionProps: { 'data-test': `card-action-${card.id}` },
                            name: `demo-${card.id}`,
                          }}
                        >
                          <Label color={kinds[card.kind].color} isCompact>
                            {kinds[card.kind].label}
                          </Label>
                        </CardHeader>
                        <CardTitle id={`card-title-${card.id}`}>{card.title}</CardTitle>
                        <CardBody>{card.body}</CardBody>
                        <CardFooter>
                          {cardBusy ? (
                            <>
                              <Spinner size="md" /> {t('Creating…')}
                            </>
                          ) : pipeline && runName && runNamespace === namespace ? (
                            t('View run')
                          ) : (
                            action
                          )}
                        </CardFooter>
                      </Card>
                    </GalleryItem>
                  );
                })}
              </Gallery>
            )}
          </Tab>
          <Tab
            eventKey="activity"
            title={<TabTitleText>{t('Activity')}</TabTitleText>}
            data-test="tab-activity"
          >
            <ActivityTab namespace={namespace} />
          </Tab>
        </Tabs>
      </PageSection>
      <AlertGroup isToast isLiveRegion>
        {error && (
          <Alert
            variant="danger"
            title={t('PipelineRun creation failed')}
            actionClose={
              <AlertActionCloseButton
                onClose={() => {
                  setError(undefined);
                }}
              />
            }
            data-test="toast-create-error"
          >
            {error}
          </Alert>
        )}
        {runName && dismissedRun !== runName && (
          <Alert
            variant="info"
            title={runAlreadyExists ? t('PipelineRun already exists') : t('PipelineRun created')}
            timeout={8000}
            onTimeout={() => {
              setDismissedRun(runName);
            }}
            actionLinks={
              <AlertActionLink
                onClick={() => {
                  navigate(pipelineRunPath(runNamespace ?? namespace, runName));
                }}
                data-test="view-pipeline-run"
              >
                {t('View PipelineRun')}
              </AlertActionLink>
            }
            data-test="toast-pipeline"
          >
            {runName}. {t('Delete it from Activity to run it again.')}
          </Alert>
        )}
      </AlertGroup>
    </>
  );
};

const DemosPage: FC = () => (
  <RouterBridge>
    <DemosPageContent />
  </RouterBridge>
);

export default DemosPage;
