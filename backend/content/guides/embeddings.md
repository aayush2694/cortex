## In short

An **embedding** is a list of numbers (a vector, often 256 to 3,072 numbers long) that represents the meaning
of a piece of text, an image or an item, produced by a trained model. Things with similar meaning get vectors
that point in similar directions, so "How do I reset my password?" lands near "I forgot my login" even though
they share no words. Similarity is usually measured with **cosine similarity** or a dot product. Embeddings
power semantic search, retrieval-augmented generation (RAG), recommendations, clustering, deduplication and
classification, and they are stored and searched in **vector databases** or vector indexes such as pgvector.

## The idea

Computers compare strings by characters, which misses meaning. "Car" and "automobile" look nothing alike;
"bank" in "river bank" and "bank account" look identical. An embedding model reads text and outputs coordinates
in a "meaning space", learned from huge amounts of data so that texts used in similar contexts end up close
together.

You can picture a map where every sentence is a point. Questions about refunds cluster in one region, questions
about shipping in another. To find documents relevant to a query, embed the query and look for its nearest
neighbours on the map. That is **semantic search**, and it works across different wording and even across
languages with multilingual models.

**Cosine similarity** measures the angle between two vectors: 1 means the same direction (very similar), 0
means unrelated, −1 means opposite. Many embedding models return **normalised** vectors (length 1), in which
case cosine similarity equals the dot product, which is cheaper to compute.

Searching millions of vectors one by one is too slow, so vector indexes use **approximate nearest neighbour**
(ANN) algorithms such as **HNSW** (a navigable graph of neighbours) or **IVF** (clustering vectors into buckets).
They return almost the best matches in milliseconds, trading a little accuracy (recall) for a lot of speed.

## How it works

Building semantic search over help-centre articles:

1. **Chunk** each article into passages of a few hundred words, so each vector represents one focused idea.
2. **Embed** every chunk with an embedding model (through an API or an open-source model) and store the vector
   with the chunk's text and metadata (article ID, language, last updated).
3. **Index** the vectors (for example pgvector with an HNSW index in PostgreSQL, or a dedicated vector database).
4. At query time, embed the user's question with **the same model**, then find the top 5 most similar chunks.
5. Optionally **filter** by metadata (only English, only current product version) and **re-rank** the
   candidates with a more precise model before showing them or passing them to an LLM.

All vectors must come from the same model: vectors from different models live in different spaces and cannot be
compared. Changing the model means re-embedding everything.

## Code

```python run
import math


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


# Toy 3-dimensional "embeddings" (real ones have hundreds of dimensions and come from a model).
# Imagine the dimensions loosely mean: [money, travel, account access].
docs = {
    "How do I get a refund?":            [0.9, 0.1, 0.1],
    "Track my parcel delivery":          [0.1, 0.9, 0.0],
    "I forgot my password":              [0.0, 0.1, 0.95],
    "Charged twice for one order":       [0.85, 0.05, 0.2],
}


def search(query_vec: list[float], k: int = 2) -> list[str]:
    ranked = sorted(docs, key=lambda d: cosine(query_vec, docs[d]), reverse=True)
    return ranked[:k]


# "Can't log in to my account" shares no words with "I forgot my password", but lands near it.
assert search([0.05, 0.0, 0.9], k=1) == ["I forgot my password"]
assert set(search([0.95, 0.0, 0.1])) == {"How do I get a refund?", "Charged twice for one order"}
assert round(cosine([1, 0], [1, 0]), 6) == 1.0 and round(cosine([1, 0], [0, 1]), 6) == 0.0
```

## Trade-offs

Semantic search handles synonyms and paraphrases but can miss exact terms (product codes, error numbers,
names), where classic keyword search (BM25) excels; **hybrid search** combines both and is a common default.
Bigger embedding models and more dimensions improve quality but cost more to compute and store. A vector
extension in your existing database (pgvector) keeps one system to run and lets you join with normal data; a
dedicated vector database scales further and offers more tuning. Approximate indexes trade a little recall for
large speed gains.

## Common mistakes

- **Mixing vectors from different models** or model versions.
- **Embedding whole long documents** as one vector, which blurs many topics into one point; chunk them.
- **Relying on vectors alone** for queries that need exact matches.
- **No metadata filters**, so results include outdated or wrong-language content.
- **Not evaluating retrieval quality** with real queries and known good answers.
- **Forgetting the cost of re-embedding** everything when switching models.

## In interviews

For AI-flavoured backend roles, expect: what an embedding is, cosine similarity, how semantic search differs from
keyword search, chunking strategies, vector indexes (HNSW, IVF) and approximate search, pgvector versus a vector
database, hybrid search and re-ranking, and how you would measure retrieval quality (recall@k, MRR on a labelled
query set).

Likely follow-up questions:

- Why do similar meanings end up close together?
- When would keyword search beat semantic search?
- How would you choose a chunk size?
- What changes if you switch to a new embedding model?
