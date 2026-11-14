## In short

An AI agent is a language model running in a **loop with tools**: it receives a goal, decides which tool to call
(search the web, query a database, run code, create a ticket), your code executes the call and returns the result,
and the model decides the next step until the task is done. **Tool use** (also called function calling) is the
building block: you describe each tool with a name, a description and a JSON schema for its inputs, and the model
replies with structured calls instead of free text. Agents handle multi-step tasks that a single prompt cannot, but
they are slower, costlier and less predictable, so they need limits, permissions, logging and human approval for
risky actions.

## The idea

A single model call can only use what is in its prompt. Real tasks need fresh information and actions: "Find
yesterday's failed payments, check whether each customer was charged, and refund the duplicates." No prompt can
contain the answer; the model must **look things up and act**, step by step, adapting to what it finds.

Tool use makes that possible without the model touching anything directly. You tell the model which tools exist and
what their parameters are. When it wants to use one, it outputs a structured request such as
`{"tool": "get_payments", "input": {"status": "failed", "date": "2026-11-14"}}`. **Your code** decides whether to run
it, runs it, and sends the result back. The model never executes anything itself; your application stays in control.

The agent loop is simple:

1. Send the goal, the conversation so far and the tool definitions to the model.
2. If the model returns tool calls, execute them and append the results to the conversation.
3. Repeat until the model returns a final answer, or a limit (steps, time, cost) is reached.

Most of the engineering is around that loop: good tool descriptions (the model chooses tools based on them), small and
safe tools, clear error messages the model can recover from, limits on steps and spending, and **guardrails**: read-only
tools by default, explicit human approval before irreversible actions (payments, deletions, emails), and least-privilege
credentials.

**Workflows versus agents**: if the steps are known in advance (always retrieve, then summarise, then classify), a
fixed **workflow** of model calls is cheaper, faster and easier to test. Use an open-ended agent when the path genuinely
depends on what is found along the way.

## How it works

A support agent handling "My order 1182 still hasn't arrived":

1. The model sees the message and three tools: `get_order(order_id)`, `track_shipment(tracking_id)` and
   `create_ticket(summary, priority)`.
2. It calls `get_order("1182")`. Your code checks that this user owns order 1182 (authorisation stays in your code, not
   the model) and returns the order with its tracking ID.
3. It calls `track_shipment("TRK778")` and learns the parcel has been stuck at a depot for 6 days.
4. It decides to escalate and calls `create_ticket(...)`. This tool creates something visible to staff, so your code
   could ask for confirmation or limit its use.
5. It answers the customer with what it found and the ticket number. The full trace (each call, input, output, tokens,
   time) is logged for debugging and evaluation.

## Code

```python run
import json

ORDERS = {"1182": {"owner": "asha", "tracking": "TRK778"}}
SHIPMENTS = {"TRK778": "Held at depot for 6 days"}


def get_order(user: str, order_id: str) -> dict:
    order = ORDERS.get(order_id)
    if not order or order["owner"] != user:          # authorisation lives in code, not in the model
        return {"error": "order not found"}
    return {"order_id": order_id, "tracking": order["tracking"]}


def track_shipment(user: str, tracking_id: str) -> dict:
    return {"status": SHIPMENTS.get(tracking_id, "unknown")}


TOOLS = {"get_order": get_order, "track_shipment": track_shipment}


def fake_model(history: list[dict]) -> dict:
    """Stands in for an LLM: picks the next tool call from what it has seen so far."""
    results = [h for h in history if h["role"] == "tool"]
    if not results:
        return {"tool": "get_order", "input": {"order_id": "1182"}}
    last = json.loads(results[-1]["content"])
    if "tracking" in last:
        return {"tool": "track_shipment", "input": {"tracking_id": last["tracking"]}}
    return {"answer": f"Your parcel status: {last.get('status', last.get('error'))}."}


def run_agent(user: str, goal: str, max_steps: int = 5) -> tuple[str, list[dict]]:
    history = [{"role": "user", "content": goal}]
    for _ in range(max_steps):                       # always cap the loop
        step = fake_model(history)
        if "answer" in step:
            return step["answer"], history
        tool = TOOLS.get(step["tool"])
        result = tool(user, **step["input"]) if tool else {"error": "unknown tool"}
        history.append({"role": "tool", "name": step["tool"], "content": json.dumps(result)})
    return "Stopped: step limit reached.", history


answer, trace = run_agent("asha", "Where is order 1182?")
assert answer == "Your parcel status: Held at depot for 6 days."
assert [h["name"] for h in trace if h["role"] == "tool"] == ["get_order", "track_shipment"]
other, _ = run_agent("ben", "Where is order 1182?")
assert "not found" in other                          # another user's order is never revealed
```

## Trade-offs

Agents can solve open-ended tasks and adapt to surprises, but each step adds latency and cost, errors compound over
long chains, and behaviour is harder to test and predict than a fixed workflow. More tools give more capability but
more ways to choose wrongly; a few well-described tools usually beat many vague ones. Giving agents write access saves
human effort but raises the stakes of mistakes and prompt injection, so many products keep humans approving actions.
Standard protocols such as the Model Context Protocol (MCP) make it easier to connect agents to tools and data, but the
same permission questions remain.

## Common mistakes

- **No step, time or cost limits**, letting a confused agent loop forever.
- **Trusting the model with authorisation**; every tool must check permissions itself.
- **Irreversible actions without confirmation** (payments, deletions, sending emails).
- **Vague tool descriptions** and unhelpful errors, so the model picks wrong tools or can't recover.
- **Using an agent where a fixed workflow would do**, paying for unpredictability with no benefit.
- **No tracing**, so failures can't be debugged or evaluated.
- **Ignoring prompt injection** from tool results such as web pages or emails.

## In interviews

Expect: what tool use is and how the loop works, how you would design the tools for a given agent, workflows versus
agents, guardrails and human-in-the-loop, handling errors and retries inside the loop, evaluating agents (task success
rate on a test set, cost and steps per task), security (least privilege, prompt injection, data leakage), and how you
would monitor an agent in production.

Likely follow-up questions:

- How does the model "call" a tool if it can't run code?
- How would you stop an agent from taking a dangerous action?
- When is a fixed workflow better than an agent?
- How would you measure whether an agent is getting better?
