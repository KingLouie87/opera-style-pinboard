export type Board = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  cover_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardSection = {
  id: string;
  board_id: string;
  user_id: string;
  title: string;
  description: string | null;
  position: number;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type Pin = {
  id: string;
  board_id: string;
  section_id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  url: string | null;
  image_url: string | null;
  image_path: string | null;
  notes: string | null;
  color: string | null;
  status: string | null;
  tags: string[] | null;
  position: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  favicon: string | null;
  images: string[];
};

export type Notebook = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotebookSection = {
  id: string;
  notebook_id: string;
  user_id: string;
  title: string;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotePage = {
  id: string;
  notebook_id: string;
  section_id: string | null;
  user_id: string;
  title: string;
  content: string;
  tags: string[] | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
