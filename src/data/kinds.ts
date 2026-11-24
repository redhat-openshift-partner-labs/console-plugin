import type { DemoCard } from './cards';

export function getKinds(
  t: (key: string) => string,
): Record<DemoCard['kind'], { label: string; action: string; color: 'teal' }> {
  return {
    quickstart: { label: t('Walkthrough'), action: t('Start walkthrough'), color: 'teal' },
  };
}
