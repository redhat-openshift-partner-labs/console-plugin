import type { DemoCard } from './cards';
import { ALL_NAMESPACES_KEY } from './namespace';

export function getKinds(
  t: (key: string, options?: { namespace?: string }) => string,
  namespace: string,
): Record<DemoCard['kind'], { label: string; action: string; color: 'teal' | 'orange' }> {
  return {
    quickstart: { label: t('Walkthrough'), action: t('Start walkthrough'), color: 'teal' },
    pipeline: {
      label: t('Pipeline'),
      action:
        namespace === ALL_NAMESPACES_KEY
          ? t('Select a project to run')
          : t('Run in {{namespace}}', { namespace }),
      color: 'orange',
    },
  };
}
