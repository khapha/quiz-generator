export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  source: string;
};

export type Quiz = {
  id: string;
  title: string;
  sourceFile: string;
  questions: QuizQuestion[];
};

export type DeckMeta = {
  id: string;
  title: string;
  count: number;
};
