## In short

Full-text search finds documents by the words they contain, fast, and ranks them by relevance. The core
structure is the **inverted index**: for every word, a sorted list of the documents (and positions) that
contain it, like the index at the back of a book. Text is **analysed** before indexing (split into tokens,
lowercased, stemmed, stop words removed), and queries are analysed the same way. Matches are scored with
formulas like **BM25**, which reward rare words and frequent occurrences. Engines such as Elasticsearch,
OpenSearch, Solr and Meilisearch do this at scale; PostgreSQL's full-text search covers many smaller needs.

## The idea

A query like `WHERE description LIKE '%wireless headphones%'` must read every row, and it only finds that
exact phrase. It misses "Headphones, wireless", "headphone" and "wirelessly", and it cannot say which result
is most relevant. Search engines solve all three problems.

An **inverted index** flips the data around. Instead of "document → words", it stores "word → documents". To
find documents with "wireless" and "headphones", look up both lists and intersect them: each list is sorted,
so this is fast even with millions of documents.

**Analysis** makes matching forgiving. The text "Running Shoes for Runners!" might become the tokens `run`,
`shoe`, `runner` after lowercasing, removing punctuation and the stop word "for", and **stemming** (reducing
words to a root). The query "running shoe" is analysed the same way, so it matches. Language-specific
analysers, synonyms ("tv" = "television") and typo tolerance (fuzzy matching by edit distance) improve
results further.

**Relevance ranking** decides the order. BM25 scores a document higher when the query word appears in it more
often (with diminishing returns), when the word is rare across all documents (matching "headphones" means
more than matching "the"), and when the document is shorter. Real products add business signals on top:
popularity, freshness, ratings, personalisation, or boosting matches in the title over the body.

## How it works

Adding product search to an online store:

1. **Source of truth** stays in PostgreSQL. A search index (say Elasticsearch) holds a copy shaped for
   search: title, description, brand, category, price, rating.
2. **Indexing pipeline**: when a product changes, an event (or a change-data-capture stream from the
   database) triggers a worker that updates the search document. The index is **eventually consistent**,
   typically seconds behind.
3. **Query**: the user types "wireles headphones under 100". The app sends a query with fuzzy matching on
   title and description (boosting title), a **filter** `price < 100` (filters don't affect the score and
   are cached), and **facets** (counts by brand and category for the sidebar).
4. **Ranking**: BM25 relevance combined with a popularity boost.
5. **Autocomplete** uses a separate prefix-optimised field, because it must answer in a few milliseconds per
   keystroke.

The index is split into **shards** spread across nodes, each with **replicas**: queries fan out to all shards
and the results are merged.

## Trade-offs

A dedicated search engine gives excellent relevance, typo tolerance, facets and scale, but adds a cluster to
run, a sync pipeline to maintain, and stale results during the sync delay. PostgreSQL full-text search
(`tsvector`, GIN indexes) plus `pg_trgm` for fuzzy matching avoids all of that and is enough for many apps
with thousands to a few million documents. Newer **semantic search** uses embeddings to match meaning rather
than words; many systems combine it with keyword search (hybrid search) because exact terms like product codes
still matter.

## Common mistakes

- **`LIKE '%term%'` on large tables**, which scans everything and ranks nothing.
- **Treating the search index as the source of truth**; it should be rebuildable from the database.
- **No reindexing plan** when the mapping or analysers change; use index aliases to swap a rebuilt index in.
- **Different analysis at index time and query time**, so terms never match.
- **Deep pagination** (`page=500`) on search results, which is expensive; use search-after cursors.
- **Ignoring relevance tuning**: default settings rarely match what users expect.

## In interviews

Expect "design search for an e-commerce site" or "design typeahead". Cover the inverted index, text analysis,
ranking (BM25 plus business signals), how the index stays in sync with the database, sharding and
replication of the index, filters and facets, autocomplete with prefix structures (tries or edge n-grams),
and latency targets. Mention when PostgreSQL's built-in search is enough.

Likely follow-up questions:

- How does an inverted index answer a query with two words?
- How do you keep the search index in sync with the database?
- How would you implement autocomplete that responds in under 50 ms?
- How would you handle typos in queries?
