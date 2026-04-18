export type ReadinessBand =
  | 'franchise_ready'
  | 'recruitment_only'
  | 'not_ready';

export type ScoreDimensionRow = {
  key: string;
  label: string;
  score: number;
  max: number;
};

export type GapArea = { title: string; description: string };

export type ScorecardDataPayload = {
  version: 1;
  generatedAt: string;
  totalScore: number;
  readinessBand: ReadinessBand;
  readinessSummary: string;
  dimensions: ScoreDimensionRow[];
  gapAreas: GapArea[];
  pdfFileName: string;
  /** Public URL after upload (local /uploads or S3) */
  scorecardPdfUrl: string;
  brandingCompanyName: string;
};
