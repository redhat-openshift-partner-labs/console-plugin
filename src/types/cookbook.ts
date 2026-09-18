export interface TextBlock {
  type: 'text';
  value: string;
}

export interface StepsBlock {
  type: 'steps';
  items: string[];
}

export interface CommandBlock {
  type: 'command';
  value: string;
  action?: string;
}

export interface NoteBlock {
  type: 'note';
  value: string;
  variant?: 'info' | 'warning';
}

export type ContentBlock = TextBlock | StepsBlock | CommandBlock | NoteBlock;

export interface CookbookSection {
  heading: string;
  level: 2 | 3;
  content: ContentBlock[];
}
