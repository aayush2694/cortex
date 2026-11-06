# Cortex — System Design Docs

These documents describe how Cortex is built and why. Read them in order the first time; after that, use them as reference.

> Diagrams are written in [Mermaid](https://mermaid.js.org/). They render automatically on GitHub and in VS Code (with the "Markdown Preview Mermaid Support" extension).

## Reading order

| # | Document | What it answers |
|---|---|---|
| 01 | [Overview](01-overview.md) | What is Cortex, who is it for, what does the whole system look like? |
| 02 | [Backend Architecture](02-backend-architecture.md) | How is the Python backend organised, layer by layer? |
| 03 | [Data Model](03-data-model.md) | What do we store, in which tables, and how are they related? |
| 04 | [API Design](04-api-design.md) | Which endpoints exist and what do they look like? |
| 05 | [DSA Visualizer](05-dsa-visualizer.md) | How does real Python code turn into browser animations? |
| 06 | [AI Tutor & RAG](06-ai-tutor-and-rag.md) | How does the tutor know what you know, and how does retrieval work? |
| 07 | [Learning Engine](07-learning-engine.md) | Knowledge map, mastery scores, spaced repetition, "what next?" |

## Status

These are **design documents**: they describe the target system. Each doc marks which roadmap phase builds each part (`Phase 1`, `Phase 2`, ...). Where a decision is still open it is marked **Open question**.
