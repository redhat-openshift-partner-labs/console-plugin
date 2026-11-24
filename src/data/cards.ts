import * as cardsData from '../cards.yaml';

export interface DemoCard {
  id: string;
  kind: 'quickstart';
  title: string;
  body: string;
  quickStartId: string;
}

const loadedCards = Array.isArray(cardsData) ? cardsData : cardsData.default;

if (!Array.isArray(loadedCards)) {
  throw new Error('src/cards.yaml must contain a list of cards.');
}

export const cards = loadedCards as DemoCard[];
