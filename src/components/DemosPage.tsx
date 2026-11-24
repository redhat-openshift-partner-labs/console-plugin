import {
  DocumentTitle,
  ListPageHeader,
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
  PageSection,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { cards } from '../data/cards';
import RouterBridge from './RouterBridge';
import './demos.css';

const DemosPageContent: FC = () => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const { setActiveQuickStart } = useQuickStartContext();
  const [query, setQuery] = useState('');

  const filteredCards = cards.filter((card) =>
    `${card.title} ${card.body}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <>
      <DocumentTitle>{t('Partner Labs Demos')}</DocumentTitle>
      <ListPageHeader title={t('Partner Labs Demos')} />
      <PageSection>
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
          </ToolbarContent>
        </Toolbar>
        {filteredCards.length === 0 ? (
          <EmptyState titleText={t('No demos match your search')} headingLevel="h2">
            <EmptyStateBody>{t('Try another search term.')}</EmptyStateBody>
            <EmptyStateActions>
              <Button
                variant="link"
                onClick={() => {
                  setQuery('');
                }}
                data-test="clear-search"
              >
                {t('Clear search')}
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
                  />
                  <CardTitle id={`card-title-${card.id}`}>{card.title}</CardTitle>
                  <CardBody>{card.body}</CardBody>
                  <CardFooter>{t('Start walkthrough')}</CardFooter>
                </Card>
              </GalleryItem>
            ))}
          </Gallery>
        )}
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
