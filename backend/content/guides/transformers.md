## In short

The **transformer** is the neural network architecture behind modern large language models (LLMs). Text is
split into **tokens**, each token becomes an embedding vector plus position information, and the vectors pass
through many layers of **self-attention** and small feed-forward networks. **Attention** lets every token look
at every other token and decide how much each one matters for its own meaning. LLMs are trained to **predict the
next token** on huge amounts of text, then refined with instruction tuning and human feedback. Generation repeats
next-token prediction one token at a time. Attention's cost grows with the square of the input length, which is
why **context windows** are limited and long prompts cost more.

## The idea

In "The animal didn't cross the street because **it** was too tired", what does "it" refer to? You know it is
the animal because you looked back at the other words. Older models (recurrent networks) read words one at a time
and struggled to carry information across long distances. Attention solves this directly: when processing "it",
the model computes how relevant every other word is and blends in information from the most relevant ones
("animal", "tired").

Mechanically, each token's vector is turned into three vectors:

- a **query** ("what am I looking for?"),
- a **key** ("what do I contain?"),
- a **value** ("what information do I pass on?").

The attention score between two tokens is the dot product of one's query with the other's key, scaled and turned
into weights with **softmax** (so they are positive and sum to 1). Each token's output is the weighted sum of all
the values. **Multi-head attention** does this several times in parallel with different learned projections, so
different heads can track different relationships (grammar, references, topic).

Because all tokens are processed in parallel rather than one after another, transformers train efficiently on
GPUs, which is what made today's model sizes practical. In LLMs (decoder-only transformers), a **causal mask**
stops each token from attending to tokens after it, since it must predict the future without seeing it.

## How it works

How an LLM answers "The capital of France is":

1. **Tokenise**: the text becomes token IDs (common words are one token; rare words split into pieces).
2. **Embed** each token and add position information.
3. Pass the vectors through dozens of transformer layers (attention plus feed-forward, with residual connections
   and normalisation).
4. The final vector for the last position is turned into a score for every token in the vocabulary; softmax turns
   scores into probabilities. " Paris" gets a high probability.
5. **Sampling** picks the next token, controlled by **temperature** (lower is more predictable) and settings like
   top-p.
6. Append the token and repeat until a stop condition. A **KV cache** keeps earlier tokens' keys and values so
   each new step does not recompute them.

This explains practical behaviour: models can produce fluent but wrong text (they predict likely tokens, not
verified facts), costs scale with input and output tokens, and everything the model "knows" in a conversation must
fit in the context window.

## Code

```python run
import math


def softmax(xs: list[float]) -> list[float]:
    m = max(xs)                                      # subtract the max for numerical stability
    exps = [math.exp(x - m) for x in xs]
    total = sum(exps)
    return [e / total for e in exps]


def attention(queries, keys, values):
    """Scaled dot-product attention for a few tokens, in plain Python."""
    d = len(keys[0])
    out = []
    for q in queries:
        scores = [sum(qi * ki for qi, ki in zip(q, k)) / math.sqrt(d) for k in keys]
        weights = softmax(scores)                     # how much this token attends to each token
        out.append([sum(w * v[j] for w, v in zip(weights, values)) for j in range(len(values[0]))])
    return out, weights


# Three tokens. The last token's query matches the first token's key strongly.
keys = [[1.0, 0.0], [0.0, 1.0], [0.2, 0.2]]
values = [[10.0, 0.0], [0.0, 10.0], [1.0, 1.0]]
query_for_last = [[3.0, 0.0]]
out, weights = attention(query_for_last, keys, values)

assert abs(sum(weights) - 1) < 1e-9                  # attention weights sum to 1
assert weights[0] > weights[2] > weights[1]          # most attention goes to the matching token
assert out[0][0] > out[0][1]                         # so the output mostly carries token 0's value
```

## Trade-offs

Transformers model long-range relationships well and parallelise training, but attention's cost grows
quadratically with sequence length, so long contexts are expensive in compute and memory. Bigger models are more
capable but slower and costlier to run; smaller or distilled models are cheaper and faster for narrow tasks.
Techniques such as efficient attention variants, KV caching, quantisation and mixture-of-experts layers trade
some complexity or quality for speed and cost. For many products the real decision is which hosted model to call,
balancing quality, latency, cost and data privacy.

## Common mistakes

- **Treating model output as fact**; LLMs can produce confident, plausible errors (hallucinations).
- **Confusing words with tokens**; limits and prices are in tokens, and a word can be several tokens.
- **Assuming the model remembers** past conversations; it only sees what is in the current context.
- **Ignoring temperature and sampling settings** when you need consistent, repeatable output.
- **Thinking bigger is always better**, when a smaller model meets the quality bar at a fraction of the cost.

## In interviews

Software engineers are rarely asked to derive attention, but should explain: what a token is, self-attention
with queries, keys and values at a high level, why transformers replaced recurrent networks, next-token prediction
and sampling (temperature), context windows and why long inputs cost more, hallucinations, and the practical
trade-offs of choosing and serving models (latency, cost, KV cache, batching).

Likely follow-up questions:

- What does attention compute, in plain words?
- Why does a longer context cost more?
- What does temperature change?
- Why can an LLM state something false with confidence?
