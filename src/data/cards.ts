import * as cardsData from '../cards.yaml';
import type { TopicId } from './topics';

export interface DemoCard {
  id: string;
  kind: 'quickstart';
  topic: TopicId;
  // Equal to the ConsoleQuickStart's spec.durationMinutes; scripts/quickstarts.ts checks it.
  durationMinutes: number;
  title: string;
  body: string;
  quickStartId: string;
}

const loadedCards = Array.isArray(cardsData) ? cardsData : cardsData.default;

if (!Array.isArray(loadedCards)) {
  throw new Error('src/cards.yaml must contain a list of cards.');
}

export const cards = loadedCards as DemoCard[];
