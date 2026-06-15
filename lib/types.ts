export type Board = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  cover_path: string | null;
  archived_at: string | null;
  deleted_at: string | null;
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
  is_collapsed: boolean | null;
  created_at: string;
  updated_at: string;
};

export type MediaKind = 'webpage' | 'image' | 'video' | 'pdf' | 'audio' | 'file';

export type Pin = {
  id: string;
  board_id: string;
  section_id: string | null;
  user_id: string;
  title: string | null;
  description: string | null;
  url: string | null;
  image_url: string | null;
  image_path: string | null;
  notes: string | null;
  color: string | null;
  dominant_color: string | null;
  status: string | null;
  category: string | null;
  source: string | null;
  tags: string[] | null;
  media_kind: MediaKind | null;
  content_type: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  aspect_ratio: number | null;
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
  source: string | null;
  mediaKind: MediaKind;
  contentType: string | null;
  suggestedTags: string[];
  images: string[];
  videoEmbedUrl: string | null;
};
