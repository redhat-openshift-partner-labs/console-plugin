import type { LabelProps } from '@patternfly/react-core';

// Order fixes the toolbar toggle order. Values must match `topic` in src/cards.yaml.
export const TOPIC_IDS = ['setup', 'create', 'operate', 'networking', 'windows'] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

export function getTopics(
  t: (key: string) => string,
): Record<TopicId, { label: string; color: LabelProps['color'] }> {
  return {
    setup: { label: t('Setup'), color: 'teal' },
    create: { label: t('Create VMs'), color: 'blue' },
    operate: { label: t('Operate VMs'), color: 'green' },
    networking: { label: t('Networking'), color: 'purple' },
    windows: { label: t('Windows'), color: 'orange' },
  };
}
