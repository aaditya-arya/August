-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the notes table (The Daily Feed raw dumps)
create table notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the extracted_items table (Categorized snippets and nodes for the Brain Graph)
create table extracted_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade not null,
  category text not null, -- 'Done', 'Idea', 'Wishlist', 'Media', 'Shaairi_Quote', 'Learning'
  content text not null,
  tags text[] default '{}',
  sentiment_or_mood text,
  embedding vector(768), -- Gemini text-embedding-004 produces 768-dimensional vectors
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index for vector similarity search (optional, for performance on large datasets)
-- Using HNSW index for cosine distance
create index on extracted_items using hnsw (embedding vector_cosine_ops);
