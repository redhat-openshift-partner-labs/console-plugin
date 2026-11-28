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
  LabelGroup,
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
import { OutlinedClockIcon } from '@patternfly/react-icons';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { cards } from '../data/cards';
import { getKinds } from '../data/kinds';
import { getTopics, TOPIC_IDS, type TopicId } from '../data/topics';
import ActivityTab from './ActivityTab';
import RouterBridge from './RouterBridge';
import './demos.css';

const DemosPageContent: FC = () => {
  const { t } = useTranslation('plugin__console-demos-ocp-virtualization');
  const [namespace] = useActiveNamespace();
  const kinds = getKinds(t);
  const topics = getTopics(t);
  const { setActiveQuickStart } = useQuickStartContext();
  const [activeTab, setActiveTab] = useState<'catalog' | 'activity'>('catalog');
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicId | 'all'>('all');

  const filteredCards = cards.filter((card) => {
    const matchesTopic = selectedTopic === 'all' || card.topic === selectedTopic;
    const text = `${card.title} ${card.body}`.toLocaleLowerCase();
    return matchesTopic && text.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <>
      <DocumentTitle>{t('Virtualization Demos')}</DocumentTitle>
      <NamespaceBar />
      <ListPageHeader title={t('Virtualization Demos')} />
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
            <Toolbar className="console-demos-ocp-virtualization__toolbar">
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
                <ToolbarItem className="console-demos-ocp-virtualization__topic-scroll">
                  <ToggleGroup aria-label={t('Filter by topic')}>
                    <ToggleGroupItem
                      text={t('All')}
                      isSelected={selectedTopic === 'all'}
                      onChange={() => {
                        setSelectedTopic('all');
                      }}
                      data-test="topic-all"
                    />
                    {TOPIC_IDS.map((topic) => (
                      <ToggleGroupItem
                        key={topic}
                        text={topics[topic].label}
                        isSelected={selectedTopic === topic}
                        onChange={() => {
                          setSelectedTopic(topic);
                        }}
                        data-test={`topic-${topic}`}
                      />
                    ))}
                  </ToggleGroup>
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>
            {filteredCards.length === 0 ? (
              <EmptyState titleText={t('No demos match your filters')} headingLevel="h2">
                <EmptyStateBody>{t('Try another search or topic.')}</EmptyStateBody>
                <EmptyStateActions>
                  <Button
                    variant="link"
                    onClick={() => {
                      setQuery('');
                      setSelectedTopic('all');
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
                        <LabelGroup aria-label={t('Topic and duration')}>
                          <Label color={topics[card.topic].color} isCompact>
                            {topics[card.topic].label}
                          </Label>
                          <Label
                            variant="outline"
                            color="grey"
                            icon={<OutlinedClockIcon />}
                            isCompact
                          >
                            {t('{{minutes}} min', { minutes: card.durationMinutes })}
                          </Label>
                        </LabelGroup>
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
