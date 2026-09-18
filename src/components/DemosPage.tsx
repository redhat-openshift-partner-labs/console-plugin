import {
  DocumentTitle,
  k8sCreate,
  k8sListItems,
  ListPageHeader,
  useActiveNamespace,
  useK8sWatchResource,
  useQuickStartContext,
} from '@openshift-console/dynamic-plugin-sdk';
import type { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Gallery,
  GalleryItem,
  Label,
  PageSection,
  ProgressStep,
  ProgressStepper,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { CheckCircleIcon, PlayIcon, TimesCircleIcon } from '@patternfly/react-icons';
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router';
import * as cardsData from '../cards.yaml';

import './demos.css';

interface DemoCard {
  id: string;
  title: string;
  body: string;
  pipelineRef?: string;
  pipelineSteps?: string[];
  pipelineParams?: Record<string, string>;
  quickStartId?: string;
}

const cards = (
  Array.isArray(cardsData) ? cardsData : (cardsData as { default: DemoCard[] }).default
) as DemoCard[];

const STORAGE_KEY = 'partner-labs-pipeline-run';

interface StoredRun {
  name: string;
  cardId: string;
  namespace: string;
}

function saveRun(run: StoredRun) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  } catch {
    /* noop */
  }
}

function loadRun(): StoredRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearRun() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

const DeploymentModel = {
  apiVersion: 'v1',
  apiGroup: 'apps',
  kind: 'Deployment',
  abbr: 'D',
  label: 'Deployment',
  labelPlural: 'Deployments',
  plural: 'deployments',
  namespaced: true,
};

const PipelineRunModel = {
  apiVersion: 'v1',
  apiGroup: 'tekton.dev',
  kind: 'PipelineRun',
  abbr: 'PLR',
  label: 'PipelineRun',
  labelPlural: 'PipelineRuns',
  plural: 'pipelineruns',
  namespaced: true,
};

const DEMO_LABEL = 'partner-labs-console-plugin/demo';

function kebabToTitle(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PipelineRunStatusShape {
  conditions?: { type: string; status: string; reason: string; message: string }[];
  childReferences?: {
    name: string;
    pipelineTaskName: string;
    kind: string;
  }[];
}

function getOverallStatus(
  pr: K8sResourceCommon | undefined,
): 'idle' | 'running' | 'succeeded' | 'failed' {
  if (!pr) return 'idle';
  const status = (pr as unknown as { status?: PipelineRunStatusShape }).status;
  if (!status?.conditions?.length) return 'running';
  const cond = status.conditions.find((c) => c.type === 'Succeeded');
  if (!cond) return 'running';
  if (cond.status === 'True') return 'succeeded';
  if (cond.status === 'False') return 'failed';
  return 'running';
}

function getCompletedTasks(pr: K8sResourceCommon | undefined): Set<string> {
  const completed = new Set<string>();
  if (!pr) return completed;
  const status = (pr as unknown as { status?: PipelineRunStatusShape }).status;
  const refs = status?.childReferences ?? [];
  for (const ref of refs) {
    completed.add(ref.pipelineTaskName);
  }
  return completed;
}

type SetupPhase = 'idle' | 'creating-deployment' | 'creating-pipelinerun' | 'done';

function getStepVariant(
  step: string,
  setupStatus: SetupPhase,
  overall: string,
  completedTasks: Set<string>,
  steps: string[],
): 'pending' | 'info' | 'success' | 'danger' {
  if (step === 'create-deployment') {
    if (setupStatus === 'idle') return 'pending';
    if (setupStatus === 'creating-deployment') return 'info';
    return 'success';
  }

  if (setupStatus !== 'done') return 'pending';

  if (overall === 'succeeded') return 'success';
  if (overall === 'failed') {
    if (completedTasks.has(step)) return 'success';
    const pipelineSteps = steps.filter((s) => s !== 'create-deployment');
    const stepIdx = pipelineSteps.indexOf(step);
    const lastCompleted = pipelineSteps.reduce(
      (max, s, i) => (completedTasks.has(s) ? i : max),
      -1,
    );
    if (stepIdx === lastCompleted + 1) return 'danger';
    return 'pending';
  }
  if (overall === 'running') {
    if (completedTasks.has(step)) return 'success';
    const pipelineSteps = steps.filter((s) => s !== 'create-deployment');
    const stepIdx = pipelineSteps.indexOf(step);
    const lastCompleted = pipelineSteps.reduce(
      (max, s, i) => (completedTasks.has(s) ? i : max),
      -1,
    );
    if (stepIdx === lastCompleted + 1) return 'info';
    return 'pending';
  }
  return 'pending';
}

const DemosPage: FC = () => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const navigate = useNavigate();
  const [activeNamespace] = useActiveNamespace();
  const { setActiveQuickStart } = useQuickStartContext();
  const [pipelineRunName, setPipelineRunName] = useState<string | null>(null);
  const [pipelineCardId, setPipelineCardId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupPhase>('idle');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const stored = loadRun();
    if (stored && stored.namespace === activeNamespace) {
      setPipelineRunName(stored.name);
      setPipelineCardId(stored.cardId);
      setSetupStatus('done');
      setDrawerOpen(true);
      setRestored(true);
      return;
    }

    // Fallback: query for the latest running PipelineRun with our label
    const pipelineCards = cards.filter((c) => c.pipelineRef);
    if (!pipelineCards.length) {
      setRestored(true);
      return;
    }

    (async () => {
      for (const card of pipelineCards) {
        try {
          const items = await k8sListItems({
            model: PipelineRunModel,
            queryParams: {
              ns: activeNamespace,
              labelSelector: `${DEMO_LABEL}=${card.id}`,
            },
          });
          const running = items
            .sort((a, b) => {
              const ta = a.metadata?.creationTimestamp ?? '';
              const tb = b.metadata?.creationTimestamp ?? '';
              return tb.localeCompare(ta);
            })
            .find((item) => {
              const status = getOverallStatus(item);
              return status === 'running';
            });

          if (running?.metadata?.name) {
            setPipelineRunName(running.metadata.name);
            setPipelineCardId(card.id);
            setSetupStatus('done');
            setDrawerOpen(true);
            saveRun({ name: running.metadata.name, cardId: card.id, namespace: activeNamespace });
            break;
          }

          // Also restore the most recent completed run so the user sees the result
          const latest = items[0];
          if (latest?.metadata?.name) {
            const latestStatus = getOverallStatus(latest);
            if (latestStatus === 'succeeded' || latestStatus === 'failed') {
              setPipelineRunName(latest.metadata.name);
              setPipelineCardId(card.id);
              setSetupStatus('done');
              setDrawerOpen(true);
              saveRun({ name: latest.metadata.name, cardId: card.id, namespace: activeNamespace });
              break;
            }
          }
        } catch {
          // Tekton may not be installed or RBAC may prevent listing
        }
      }
      setRestored(true);
    })();
  }, [activeNamespace]);

  const watchResource = useMemo(
    () =>
      pipelineRunName
        ? {
            groupVersionKind: { group: 'tekton.dev', version: 'v1', kind: 'PipelineRun' },
            name: pipelineRunName,
            namespace: activeNamespace,
          }
        : null,
    [pipelineRunName, activeNamespace],
  );

  const [pipelineRun, loaded, watchError] = useK8sWatchResource<K8sResourceCommon>(watchResource);

  const pr = pipelineRunName && loaded ? pipelineRun : undefined;
  const overall = pipelineRunName ? (loaded ? getOverallStatus(pr) : 'running') : 'idle';
  const completedTasks = getCompletedTasks(pr);

  const activeCard = cards.find((c) => c.id === pipelineCardId);
  const isRunning =
    (setupStatus !== 'idle' && setupStatus !== 'done') ||
    (!!pipelineRunName && overall === 'running');

  const handleRunPipeline = useCallback(
    async (card: DemoCard) => {
      if (!card.pipelineRef) return;

      setCreateError(null);
      setSetupStatus('creating-deployment');

      const runName = `${card.pipelineParams?.APP_NAME ?? card.id}-${Date.now().toString(36)}`;
      const params = Object.entries(card.pipelineParams ?? {}).map(([name, value]) => {
        if (name === 'IMAGE_NAME') {
          return { name, value: value.replace('<namespace>', activeNamespace) };
        }
        return { name, value };
      });

      params.push({
        name: 'IMAGE_NAME',
        value: `image-registry.openshift-image-registry.svc:5000/${activeNamespace}/${card.pipelineParams?.APP_NAME ?? 'demo'}`,
      });

      try {
        const appName = card.pipelineParams?.APP_NAME ?? 'demo';
        const imageName = `image-registry.openshift-image-registry.svc:5000/${activeNamespace}/${appName}`;
        try {
          await k8sCreate({
            model: DeploymentModel,
            ns: activeNamespace,
            data: {
              apiVersion: 'apps/v1',
              kind: 'Deployment',
              metadata: {
                name: appName,
                namespace: activeNamespace,
                labels: {
                  app: appName,
                  'app.kubernetes.io/managed-by': 'partner-labs-console-plugin',
                },
              },
              spec: {
                replicas: 1,
                selector: { matchLabels: { app: appName } },
                template: {
                  metadata: { labels: { app: appName } },
                  spec: {
                    containers: [
                      {
                        name: appName,
                        image: imageName,
                        ports: [{ containerPort: 8080 }],
                      },
                    ],
                  },
                },
              },
            } as never,
          });
        } catch {
          // Deployment may already exist from a previous run
        }

        setSetupStatus('creating-pipelinerun');
        await k8sCreate({
          model: PipelineRunModel,
          ns: activeNamespace,
          data: {
            apiVersion: 'tekton.dev/v1',
            kind: 'PipelineRun',
            metadata: {
              name: runName,
              namespace: activeNamespace,
              labels: {
                'app.kubernetes.io/managed-by': 'partner-labs-console-plugin',
                [DEMO_LABEL]: card.id,
              },
            },
            spec: {
              pipelineRef: {
                resolver: 'cluster',
                params: [
                  { name: 'kind', value: 'pipeline' },
                  { name: 'name', value: card.pipelineRef },
                  { name: 'namespace', value: 'openshift' },
                ],
              },
              params,
              workspaces: [
                {
                  name: 'workspace',
                  volumeClaimTemplate: {
                    spec: {
                      accessModes: ['ReadWriteOnce'],
                      resources: { requests: { storage: '1Gi' } },
                    },
                  },
                },
              ],
            },
          } as never,
        });
        setSetupStatus('done');
        setPipelineRunName(runName);
        saveRun({ name: runName, cardId: card.id, namespace: activeNamespace });
      } catch (e) {
        setSetupStatus('idle');
        const msg = e instanceof Error ? e.message : String(e);
        setCreateError(msg);
      }
    },
    [activeNamespace],
  );

  const handleCardClick = useCallback(
    (card: DemoCard) => {
      if (card.pipelineRef) {
        setPipelineCardId(card.id);
        setDrawerOpen(true);
        setCreateError(null);
      } else if (card.quickStartId) {
        setActiveQuickStart?.(card.quickStartId);
      } else {
        navigate(`/partner-labs-demos/${card.id}`);
      }
    },
    [navigate, setActiveQuickStart],
  );

  const canClose =
    overall === 'succeeded' ||
    overall === 'failed' ||
    (overall === 'idle' && setupStatus === 'idle');

  const handleCloseDrawer = useCallback(() => {
    if (!canClose) return;
    setDrawerOpen(false);
    setPipelineRunName(null);
    setPipelineCardId(null);
    setCreateError(null);
    setSetupStatus('idle');
    clearRun();
  }, [canClose]);

  const handleRunAgain = useCallback(() => {
    setPipelineRunName(null);
    setCreateError(null);
    setSetupStatus('idle');
    clearRun();
    if (activeCard) {
      handleRunPipeline(activeCard);
    }
  }, [activeCard, handleRunPipeline]);

  const panelContent = (
    <DrawerPanelContent widths={{ default: 'width_33' }}>
      <DrawerHead>
        <Title headingLevel="h2" size="lg">
          {activeCard ? t(activeCard.title) : t('Pipeline Run')}
        </Title>
        {canClose && (
          <DrawerActions>
            <DrawerCloseButton onClick={handleCloseDrawer} />
          </DrawerActions>
        )}
      </DrawerHead>
      <DrawerPanelBody>
        {createError && (
          <Alert
            variant="danger"
            isInline
            title={t('Failed to create PipelineRun')}
            className="partner-labs-console-plugin__drawer-alert"
          >
            {createError}
          </Alert>
        )}
        {watchError && (
          <Alert
            variant="danger"
            isInline
            title={t('Watch error')}
            className="partner-labs-console-plugin__drawer-alert"
          >
            {String(watchError)}
          </Alert>
        )}

        {setupStatus === 'idle' && !pipelineRunName && activeCard && (
          <Button
            variant="primary"
            icon={<PlayIcon />}
            onClick={() => handleRunPipeline(activeCard)}
          >
            {t('Run Pipeline')}
          </Button>
        )}

        {(setupStatus !== 'idle' || pipelineRunName) && activeCard?.pipelineSteps && (
          <ProgressStepper isVertical className="partner-labs-console-plugin__progress-stepper">
            {activeCard.pipelineSteps.map((step) => {
              const variant = getStepVariant(
                step,
                setupStatus,
                overall,
                completedTasks,
                activeCard.pipelineSteps!,
              );
              return (
                <ProgressStep
                  key={step}
                  variant={variant}
                  id={step}
                  titleId={step}
                  aria-label={kebabToTitle(step)}
                >
                  {kebabToTitle(step)}
                </ProgressStep>
              );
            })}
          </ProgressStepper>
        )}

        {pipelineRunName && (overall === 'succeeded' || overall === 'failed') && (
          <Button
            variant="secondary"
            onClick={handleRunAgain}
            className="partner-labs-console-plugin__run-again"
          >
            {t('Run Again')}
          </Button>
        )}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  if (!restored) return null;

  return (
    <>
      <DocumentTitle>{t('Partner Labs Demos')}</DocumentTitle>
      <ListPageHeader title={t('Partner Labs Demos')} />
      <PageSection>
        <Drawer isExpanded={drawerOpen} isInline>
          <DrawerContent panelContent={panelContent}>
            <DrawerContentBody>
              <Gallery hasGutter minWidths={{ default: '300px' }}>
                {cards.map((card) => {
                  const isActiveRun =
                    card.id === pipelineCardId && (setupStatus !== 'idle' || !!pipelineRunName);

                  return (
                    <GalleryItem key={card.id}>
                      <Card
                        isFullHeight
                        isClickable
                        isSelectable
                        onClick={() => {
                          handleCardClick(card);
                        }}
                        className="partner-labs-console-plugin__demo-card"
                      >
                        <CardTitle>
                          {t(card.title)}
                          {card.pipelineRef && (
                            <Label
                              color="blue"
                              isCompact
                              className="partner-labs-console-plugin__card-badge"
                            >
                              {t('Pipeline')}
                            </Label>
                          )}
                          {card.quickStartId && (
                            <Label
                              color="green"
                              isCompact
                              className="partner-labs-console-plugin__card-badge"
                            >
                              {t('Guided Walkthrough')}
                            </Label>
                          )}
                          {!card.pipelineRef && !card.quickStartId && (
                            <Label
                              color="orange"
                              isCompact
                              className="partner-labs-console-plugin__card-badge"
                            >
                              {t('Virt Cookbook')}
                            </Label>
                          )}
                          {isActiveRun && isRunning && (
                            <Spinner
                              size="sm"
                              className="partner-labs-console-plugin__card-spinner"
                            />
                          )}
                          {isActiveRun && overall === 'succeeded' && setupStatus === 'done' && (
                            <CheckCircleIcon className="partner-labs-console-plugin__card-status-success" />
                          )}
                          {isActiveRun && overall === 'failed' && setupStatus === 'done' && (
                            <TimesCircleIcon className="partner-labs-console-plugin__card-status-error" />
                          )}
                        </CardTitle>
                        <CardBody>{t(card.body)}</CardBody>
                      </Card>
                    </GalleryItem>
                  );
                })}
              </Gallery>
            </DrawerContentBody>
          </DrawerContent>
        </Drawer>
      </PageSection>
    </>
  );
};

export default DemosPage;
