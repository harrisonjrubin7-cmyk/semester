export type Course = {
  id: string;
  title: string;
  term?: string;
  timezone: string;
  counts: { files: number; review_items: number; study_assets: number; calendar_events: number };
};

export type Asset = {
  id: string;
  asset_type: string;
  title: string;
  status: string;
  content: Record<string, unknown>;
  updated_at: string;
};

export type Event = {
  id: string;
  title: string;
  event_type: string;
  event_date?: string;
  start_at?: string;
  status: string;
  time_unspecified: boolean;
};

export type Review = {
  id: string;
  title: string;
  item_type: string;
  status: string;
  payload: Record<string, unknown>;
  resolution_note?: string;
};

export type SourceFile = {
  id: string;
  filename: string;
  classification: string;
  status: string;
  size_bytes: number;
  mime_type?: string;
  page_count?: number;
};

export type SourceChunk = {
  id: string;
  chunk_index: number;
  content: string;
  content_type: string;
  page_number?: number | null;
  slide_number?: number | null;
  sheet_name?: string | null;
  cell_range?: string | null;
  start_seconds?: number | null;
  end_seconds?: number | null;
  confidence: number;
};

export type SourceView = {
  document: SourceFile;
  chunks: SourceChunk[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
};

export type WorkspaceData = {
  course: Course;
  assets: Asset[];
  events: Event[];
  reviews: Review[];
  files: SourceFile[];
};

export type Progress = {
  items: Array<{ id: string; mastery_score: number; attempts: number; correct_attempts: number; next_review_at?: string }>;
  average_mastery: number;
};
