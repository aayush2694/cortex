## In short

Retrieval-augmented generation (RAG) answers questions from **your own data**: retrieve the most relevant pieces
of your documents, put them into the prompt, and ask the model to answer **using only that context**, citing its
sources. It lets a general model answer about your products, policies or codebase without retraining, keeps answers
current (update the documents, not the model), and reduces hallucinations. The pipeline has two halves:
**indexing** (load, clean, chunk, embed and store documents) and **querying** (embed the question, retrieve,
optionally re-rank, build the prompt, generate, cite). Most quality problems come from retrieval, not from the model.

## The idea

A model's knowledge is frozen at training time and never included your internal wiki. You could paste all your
documents into every prompt, but they won't fit, and it would be slow and expensive. RAG does what a person would do:
look up the few relevant pages first, then answer from them.

It is an "open book exam" for the model. The model's job shifts from remembering facts to reading and summarising the
provided passages. That makes answers checkable (you can show the sources), keeps them fresh, and respects access
control if retrieval only returns documents the user is allowed to see.

The quality of a RAG system depends on each step:

- **Chunking**: split documents into passages small enough to be specific and large enough to make sense on their own
  (often a few hundred tokens, split along headings or paragraphs, with some overlap). Keep metadata: source, title,
  date, permissions.
- **Retrieval**: embedding search finds passages with similar meaning; keyword search (BM25) finds exact terms like
  error codes. **Hybrid search** combines both. **Metadata filters** restrict by product, language, date or user access.
- **Re-ranking**: a cross-encoder or a model scores the top ~50 candidates more precisely and keeps the best 5–10.
- **Prompting**: clear instructions to answer only from the context, to cite passage IDs, and to say "I don't know"
  when the context doesn't contain the answer.

## How it works

A support assistant over a help centre:

1. **Index**: each article is cleaned, split by heading into chunks, embedded, and stored in pgvector along with its
   text, URL, product and last-updated date. Changed articles are re-indexed automatically.
2. A user asks: "Can I change my delivery address after paying?"
3. **Retrieve**: embed the question; run vector search plus keyword search filtered to the user's region; merge
   results; re-rank to the top 5 chunks.
4. **Generate**: the prompt contains instructions, the 5 chunks wrapped in tags with IDs, and the question. The model
   answers and cites `[2]` and `[4]`.
5. **Post-process**: verify cited IDs exist, attach links, and log the question, retrieved chunk IDs and answer for
   evaluation.
6. **Evaluate**: a set of real questions with known good sources measures retrieval (did the right chunk appear in the
   top 5?) separately from generation (was the answer correct and grounded?).

## Code

```python run
import math
import re
from collections import Counter

DOCS = {
    "d1": "You can change the delivery address until the order is packed. Open Orders and choose Edit address.",
    "d2": "Refunds are processed within 5 business days after we receive the returned item.",
    "d3": "To reset your password, use Forgot password on the sign-in page.",
}


def vectorise(text: str) -> Counter:
    """Stand-in for an embedding model: a bag of lowercase words."""
    return Counter(re.findall(r"[a-z]+", text.lower()))


def cosine(a: Counter, b: Counter) -> float:
    dot = sum(a[w] * b[w] for w in a)
    norm = math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values()))
    return dot / norm if norm else 0.0


INDEX = {doc_id: vectorise(text) for doc_id, text in DOCS.items()}


def retrieve(question: str, k: int = 2) -> list[str]:
    q = vectorise(question)
    return sorted(INDEX, key=lambda d: cosine(q, INDEX[d]), reverse=True)[:k]


def build_prompt(question: str) -> str:
    context = "\n".join(f'<doc id="{d}">{DOCS[d]}</doc>' for d in retrieve(question))
    return (
        "Answer using only the documents below and cite their ids like [d1]. "
        "If they don't contain the answer, say you don't know.\n"
        f"{context}\n<question>{question}</question>"
    )


assert retrieve("Can I change my delivery address?")[0] == "d1"
assert retrieve("How long do refunds take?")[0] == "d2"
prompt = build_prompt("Can I change my delivery address?")
assert '<doc id="d1">' in prompt and "don't know" in prompt
```

## Trade-offs

RAG keeps knowledge fresh and attributable without training, but adds an indexing pipeline, a retrieval store and
more tokens per request. **Long context windows** can sometimes replace retrieval for small document sets (just
include everything), at higher cost per call. **Fine-tuning** teaches style, format or a narrow skill well, but is a
poor way to add facts that change. Bigger top-k gives the model more chances to see the answer but adds noise and
cost; re-ranking helps balance this. Agentic retrieval (letting the model search several times) handles complex
questions better at the cost of latency.

## Common mistakes

- **Bad chunking**: chunks that cut sentences in half, or are so large that the relevant part gets diluted.
- **Vector search only**, missing exact identifiers that keyword search would find.
- **Ignoring permissions**, so the assistant reveals documents the user cannot access.
- **No "I don't know" path**, so the model guesses when retrieval finds nothing useful.
- **Evaluating only final answers**; measure retrieval separately to know which half to fix.
- **Stale indexes** that are never updated when documents change.

## In interviews

"Design a chatbot over our documentation" is a common AI system design question. Cover ingestion and chunking,
embeddings and the vector store, hybrid retrieval and re-ranking, prompt construction with citations, access control,
latency and cost (caching frequent questions), evaluation of retrieval and answers, keeping the index fresh, and
handling prompt injection hidden in documents.

Likely follow-up questions:

- How do you choose chunk size and overlap?
- How would you measure whether retrieval is good enough?
- How do you stop the assistant answering from documents the user can't see?
- When would you fine-tune instead of using RAG?
