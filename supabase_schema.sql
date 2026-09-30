-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the notes table (The Daily Feed raw dumps)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the extracted_items table (Categorized snippets and nodes for the Brain Graph)
create table if not exists extracted_items (
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
create index if not exists idx_extracted_items_embedding on extracted_items using hnsw (embedding vector_cosine_ops);

-- Create the graph_edges table (Links and relationships between nodes in the Brain Graph)
create table if not exists graph_edges (
  id uuid primary key default gen_random_uuid(),
  source_node_id uuid references extracted_items(id) on delete cascade not null,
  target_node_id uuid references extracted_items(id) on delete cascade not null,
  weight float not null default 0.5, -- 0.0 to 1.0 (higher = tighter bond)
  link_type text not null, -- 'semantic' or 'explicit_tag'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_distinct_nodes check (source_node_id != target_node_id),
  constraint unique_graph_edge unique (source_node_id, target_node_id, link_type)
);

-- Indexes on source and target for rapid relationship queries
create index if not exists idx_graph_edges_source on graph_edges(source_node_id);
create index if not exists idx_graph_edges_target on graph_edges(target_node_id);
create index if not exists idx_graph_edges_type on graph_edges(link_type);

-- Vector similarity search helper function using pgvector cosine distance (<=>)
create or replace function match_similar_nodes(
  query_embedding vector(768),
  target_node_id uuid,
  match_threshold float default 0.70,
  match_count int default 5
)
returns table (
  id uuid,
  category text,
  content text,
  tags text[],
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    extracted_items.id,
    extracted_items.category,
    extracted_items.content,
    extracted_items.tags,
    (1 - (extracted_items.embedding <=> query_embedding))::float as similarity
  from extracted_items
  where extracted_items.id != target_node_id
    and extracted_items.embedding is not null
    and (1 - (extracted_items.embedding <=> query_embedding)) >= match_threshold
  order by extracted_items.embedding <=> query_embedding
  limit match_count;
end;
$$;
