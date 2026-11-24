import * as cardsData from '../cards.yaml';

interface CardBase {
  id: string;
  title: string;
  body: string;
}

export type DemoCard = CardBase &
  (
    | { kind: 'page'; path: string }
    | { kind: 'quickstart'; quickStartId: string }
    | { kind: 'pipeline' }
  );

const loadedCards = Array.isArray(cardsData) ? cardsData : cardsData.default;

if (!Array.isArray(loadedCards)) {
  throw new Error('src/cards.yaml must contain a list of cards.');
}

export const cards = loadedCards as DemoCard[];
