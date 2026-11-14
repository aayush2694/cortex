## In short

Machine learning builds programs that learn patterns from examples instead of following hand-written rules.
A **model** has adjustable numbers (**parameters**). **Training** shows it many examples, measures how wrong
its predictions are with a **loss function**, and nudges the parameters to reduce the loss, usually with
**gradient descent**. **Inference** is using the trained model on new inputs. The central danger is
**overfitting**: memorising the training examples instead of learning patterns that generalise. You detect
it by evaluating on data the model never saw (**validation** and **test** sets), with metrics that fit the
problem: accuracy, precision and recall, or error measures for numbers.

## The idea

Writing rules for "is this email spam?" by hand quickly turns into thousands of fragile `if` statements.
Machine learning flips it: collect thousands of emails labelled spam or not, and let an algorithm find which
features predict the label. The same approach powers price prediction, fraud detection, recommendations, image
recognition and large language models.

The main families:

- **Supervised learning**: examples come with the right answer (label). **Classification** predicts a
  category (spam or not); **regression** predicts a number (house price).
- **Unsupervised learning**: no labels; find structure, such as clusters of similar customers.
- **Self-supervised learning**: create labels from the data itself, for example "predict the next word". This
  is how large language models are pre-trained on huge amounts of text.

Training is an optimisation loop. Imagine standing on a foggy hillside and wanting to reach the valley: feel
which way the ground slopes and take a small step downhill, again and again. The hillside is the loss; the
slope is the **gradient**; the step size is the **learning rate**. Too small and training crawls; too large and
it overshoots and never settles.

**Overfitting** is the student who memorises last year's exam answers and fails a new exam. A model with enough
parameters can memorise its training data perfectly yet do badly on new data. **Underfitting** is the opposite:
the model is too simple to capture the pattern at all. The fixes for overfitting are more (and more varied) data,
simpler models, **regularisation** (penalising large parameters), and **early stopping** when validation loss
stops improving.

## How it works

A typical supervised project:

1. **Define the goal and metric.** "Flag fraudulent payments; catching fraud matters, but blocking good
   customers is costly." That means watching **precision** (of flagged payments, how many were fraud) and
   **recall** (of all fraud, how much was flagged), not just accuracy. If 0.1% of payments are fraud, a model
   that always says "not fraud" is 99.9% accurate and useless.
2. **Split the data**: about 70% training, 15% validation (to tune settings), 15% test (touched once at the end).
   For time-based data, split by time so the model never trains on the future.
3. **Prepare features**: clean missing values, scale numbers, encode categories, and avoid **leakage**
   (features that wouldn't be known at prediction time, such as "chargeback filed").
4. **Train** a simple baseline first (logistic regression, a decision tree), then stronger models (gradient-boosted
   trees for tables, neural networks for text and images).
5. **Evaluate** on validation data, tune, and finally report on the test set.
6. **Deploy and monitor**: real-world data drifts, so track live performance and retrain when it drops.

## Code

```python run
import random

random.seed(0)
# Data: y = 3x + 2 plus noise. The model must learn w and b from examples.
xs = [i / 10 for i in range(100)]
data = [(x, 3 * x + 2 + random.gauss(0, 0.5)) for x in xs]
random.shuffle(data)
train, test = data[:80], data[80:]                 # hold out data the model never trains on


def mse(w: float, b: float, rows: list[tuple[float, float]]) -> float:
    """Loss: mean squared error between predictions and true values."""
    return sum((w * x + b - y) ** 2 for x, y in rows) / len(rows)


w, b, lr = 0.0, 0.0, 0.01
start = mse(w, b, train)
for _ in range(2000):                              # gradient descent
    grad_w = sum(2 * (w * x + b - y) * x for x, y in train) / len(train)
    grad_b = sum(2 * (w * x + b - y) for x, y in train) / len(train)
    w, b = w - lr * grad_w, b - lr * grad_b       # step downhill

assert mse(w, b, train) < start / 50               # training reduced the loss a lot
assert abs(w - 3) < 0.3 and abs(b - 2) < 0.5       # it recovered the true pattern
assert mse(w, b, test) < 0.5                       # and it generalises to unseen data
```

## Trade-offs

Simple models (linear, decision trees) are fast, cheap and explainable, and often good enough; complex models
(deep networks, large ensembles) capture richer patterns but need more data and compute and are harder to
explain. More training data usually beats a cleverer algorithm. Accuracy, latency, cost, interpretability and
fairness pull in different directions, and the right balance depends on the product. Sometimes the best choice
is no ML at all: if a few clear rules work, they are cheaper to build and maintain.

## Common mistakes

- **Evaluating on training data**, which hides overfitting.
- **Data leakage**: features or preprocessing that peek at the answer or at the test set.
- **Accuracy on imbalanced data**; use precision, recall, F1 or ROC-AUC.
- **Random splits for time series**, which let the model learn from the future.
- **Skipping a baseline**, so you can't tell whether the complex model is worth it.
- **Never monitoring after deployment**, while the data quietly drifts.

## In interviews

For software engineers, ML questions are usually conceptual: training versus inference, supervised versus
unsupervised, what a loss function and gradient descent do, overfitting and how to prevent it, train/validation/
test splits, precision versus recall, and how you would deploy and monitor a model. For AI-adjacent backend roles,
expect questions on serving models behind an API, batching, latency and cost.

Likely follow-up questions:

- How do you know if a model is overfitting, and what would you do about it?
- When does accuracy mislead you?
- Why keep a separate test set if you already have a validation set?
- How would you notice that a deployed model has become worse?
