-- Corpus layer (spec: corpus-layer-spec.md §§3–6, 8, 12).
--
-- Two tables hold Sanctum's owned citation shelf: corpus_documents is the registry
-- (one row per work, with its provenance and license tier), corpus_chunks is the
-- searchable shelf (one row per citable piece of text, with a precomputed citation
-- label and a 768-dimension embedding for meaning-based search via pgvector).
--
-- Both tables are SERVER-ONLY: row level security is on with no public policies,
-- and every grant to the anon/authenticated roles is revoked. The only readers are
-- the corpus-retrieve edge function and the ingest scripts, both using the service
-- role. Phones never touch these tables.

create extension if not exists vector;

create table if not exists public.corpus_documents (
  id text primary key,
  title text not null,
  author text not null default '',
  year int,
  source_name text not null,
  source_url text not null,
  license_tier text not null check (license_tier in ('A', 'B')),
  authority_tier int not null check (authority_tier between 1 and 8),
  language text not null default 'en',
  shelf_tags text[] not null default '{}',
  companion_shelves text[] not null default '{}',
  version int not null default 1,
  content_hash text not null,
  chunk_count int not null default 0,
  ingest_status text not null default 'staged'
    check (ingest_status in ('staged', 'chunked', 'embedded', 'live', 'retired')),
  ingested_at timestamptz not null default now()
);

create table if not exists public.corpus_chunks (
  id bigint generated always as identity primary key,
  document_id text not null references public.corpus_documents (id) on delete cascade,
  ordinal int not null,
  doc_version int not null default 1,
  locator text not null,
  citation_label text not null,
  text text not null,
  char_count int not null,
  content_hash text not null,
  authority_tier int not null,
  shelf_tags text[] not null default '{}',
  companion_shelves text[] not null default '{}',
  embedding vector(768),
  unique (document_id, ordinal),
  unique (document_id, content_hash)
);

create index if not exists corpus_chunks_embedding_hnsw
  on public.corpus_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists corpus_chunks_document_idx
  on public.corpus_chunks (document_id);
create index if not exists corpus_chunks_tier_idx
  on public.corpus_chunks (authority_tier);
create index if not exists corpus_chunks_shelves_gin
  on public.corpus_chunks using gin (shelf_tags);
create index if not exists corpus_chunks_companion_gin
  on public.corpus_chunks using gin (companion_shelves);

-- Small key/value table the loader stamps at load time (the corpus_version every
-- retrieval response reports, so any answer can be traced to an exact shelf state).
create table if not exists public.corpus_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.corpus_documents enable row level security;
alter table public.corpus_chunks enable row level security;
alter table public.corpus_meta enable row level security;

revoke all on table public.corpus_documents from public, anon, authenticated;
revoke all on table public.corpus_chunks from public, anon, authenticated;
revoke all on table public.corpus_meta from public, anon, authenticated;
grant all on table public.corpus_documents to service_role;
grant all on table public.corpus_chunks to service_role;
grant all on table public.corpus_meta to service_role;
grant usage, select on sequence public.corpus_chunks_id_seq to service_role;

-- The one search door the corpus-retrieve function uses. Returns raw cosine
-- similarity; tier weighting, near-duplicate suppression, and companion-shelf
-- presentation order are applied by the function (spec §8.3) so the ranking
-- policy lives in one tested place.
create or replace function public.corpus_search(
  q_embedding vector(768),
  p_tiers int[] default null,
  p_shelves text[] default null,
  p_companion text default null,
  p_on_shelf_only boolean default false,
  p_language text default 'en',
  p_limit int default 32
)
returns table (
  chunk_id bigint,
  document_id text,
  locator text,
  citation_label text,
  chunk_text text,
  authority_tier int,
  license_tier text,
  shelf_tags text[],
  companion_shelves text[],
  similarity double precision
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.locator,
    c.citation_label,
    c.text,
    c.authority_tier,
    d.license_tier,
    c.shelf_tags,
    c.companion_shelves,
    (1 - (c.embedding <=> q_embedding))::double precision
  from public.corpus_chunks c
  join public.corpus_documents d on d.id = c.document_id
  where d.ingest_status = 'live'
    and d.language = p_language
    and (p_tiers is null or c.authority_tier = any (p_tiers))
    and (p_shelves is null or c.shelf_tags && p_shelves)
    and (
      not p_on_shelf_only
      or p_companion is null
      or c.companion_shelves @> array[p_companion]
    )
  order by c.embedding <=> q_embedding
  limit p_limit;
$$;

revoke execute on function public.corpus_search(vector, int[], text[], text, boolean, text, int)
  from public, anon, authenticated;
grant execute on function public.corpus_search(vector, int[], text[], text, boolean, text, int)
  to service_role;
