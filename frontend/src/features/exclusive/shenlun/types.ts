export type QuestionKind = 'essay' | 'small';
export type MaterialMode = 'upload' | 'search' | 'text';
export type ReviewStage = 'setup' | 'reading' | 'reviewing' | 'report';

export interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

export interface DemoReport {
  title: string;
  score: number;
  maxScore: number;
  level: string;
  verdict: string;
  strengths: string[];
  priorities: Array<{ title: string; detail: string }>;
  rewrite: { before: string; after: string };
}
