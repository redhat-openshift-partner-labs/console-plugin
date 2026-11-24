import {
  DocumentTitle,
  ListPageHeader,
  NamespaceBar,
  useActiveNamespace,
  useQuickStartContext,
} from '@openshift-console/dynamic-plugin-sdk';
import {
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
import { cards } from '../data/cards';
import { getKinds } from '../data/kinds';
import ActivityTab from './ActivityTab';
import RouterBridge from './RouterBridge';
import './demos.css';

const availableKinds = Array.from(new Set(cards.map((card) => card.kind)));

const DemosPageContent: FC = () => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const [namespace] = useActiveNamespace();
  const kinds = getKinds(t);
  const { setActiveQuickStart } = useQuickStartContext();
  const [activeTab, setActiveTab] = useState<'catalog' | 'activity'>('catalog');
  const [query, setQuery] = useState('');
  // Typed as string: every card shares one kind, and a literal type would make the filter constant.
  const [selectedKind, setSelectedKind] = useState<string>('all');

  const filteredCards = cards.filter((card) => {
    const matchesKind = selectedKind === 'all' || card.kind === selectedKind;
    const text = `${card.title} ${card.body}`.toLocaleLowerCase();
    return matchesKind && text.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <>
      <DocumentTitle>{t('Partner Labs Demos')}</DocumentTitle>
      <NamespaceBar />
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
                {filteredCards.map((card) => (
                  <GalleryItem key={card.id}>
                    <Card isFullHeight isClickable data-test={`card-${card.id}`}>
                      <CardHeader
                        selectableActions={{
                          onClickAction: () => {
                            setActiveQuickStart?.(card.quickStartId);
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
                      <CardFooter>{kinds[card.kind].action}</CardFooter>
                    </Card>
                  </GalleryItem>
                ))}
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
    </>
  );
};

const DemosPage: FC = () => (
  <RouterBridge>
    <DemosPageContent />
  </RouterBridge>
);

export default DemosPage;
