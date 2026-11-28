import type { DemoCard } from './cards';

export function getKinds(t: (key: string) => string): Record<DemoCard['kind'], { action: string }> {
  return {
    quickstart: { action: t('Start demo') },
  };
}
