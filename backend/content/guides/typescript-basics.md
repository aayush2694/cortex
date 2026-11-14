## In short

TypeScript is JavaScript with a static type system on top. You write `.ts` files with type
annotations, interfaces and generics; the compiler (`tsc`) checks them and then outputs plain
JavaScript, with every type removed. Types never exist at run time, so they cost nothing in the
browser but also cannot validate data arriving from an API. The everyday toolkit is: primitive
types, `interface` and `type` for object shapes, union types with **narrowing**, generics, `unknown`
instead of `any`, and `strict` mode in `tsconfig.json`. Angular, and most large frontends and Node
backends, are written in TypeScript.

## The idea

JavaScript lets you call `user.adress.city` and only tells you about the typo when that line runs,
perhaps in production. TypeScript moves that discovery to the moment you type it: your editor
underlines the mistake, autocompletes property names, and refactors safely across a whole codebase.
The bigger the project and the team, the more that matters.

TypeScript's types are **structural**: two types are compatible if they have the same shape, whatever
their names. If a function expects `{ id: number; name: string }`, any object with those properties
fits. This matches how JavaScript code is actually written, with plain objects everywhere.

The most useful idea to learn early is **narrowing**. A value of type `string | number` could be
either, so you cannot call `.toUpperCase()` on it. After `if (typeof value === "string")`, the
compiler knows that inside the `if` it is a string. The same works with `in`, `instanceof`, equality
checks and, most powerfully, **discriminated unions**: objects that share a literal field such as
`kind: "circle" | "square"`. Switch on that field and each branch sees exactly the right shape.

Because types disappear when compiled, data from outside (HTTP responses, `localStorage`, user input)
is only *assumed* to match its declared type. Validate it at the boundary (by hand, or with a library
such as Zod) when correctness matters.

## How it works

Write a typed fetch helper and follow what the compiler does:

```ts
interface User { id: number; name: string; email?: string }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const user = await getJson<User>("/api/users/1");
user.name.toUpperCase();   // OK
user.email.length;         // error: 'email' is possibly 'undefined'
```

1. `email?: string` makes the property optional, so its type is `string | undefined`.
2. `getJson<T>` is **generic**: the caller chooses `T`, and the return type follows.
3. `as T` is a **type assertion**: you tell the compiler to trust you. It checks nothing at run time,
   which is exactly why API data should be validated.
4. With `strict` on, the compiler forces you to handle `undefined` (`user.email?.length ?? 0`). This
   one setting prevents a large class of "cannot read properties of undefined" crashes.

## Code

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {                 // discriminated union: each case is narrowed
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rect":
      return shape.width * shape.height;
    default: {
      const unreachable: never = shape; // compile error if a new kind is not handled
      return unreachable;
    }
  }
}

// Generics with a constraint: T must have an id.
function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

// Utility types derive new types from existing ones.
interface Todo { id: number; title: string; done: boolean }
type TodoPatch = Partial<Omit<Todo, "id">>;          // every field optional, no id
type TodoPreview = Pick<Todo, "id" | "title">;

// unknown forces a check before use; any would turn checking off.
function parsePort(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  throw new Error("invalid port");
}
```

The `never` check in `area` is a common trick: if someone adds `{ kind: "triangle" }` to `Shape`, the
compiler points at every switch that forgot to handle it.

## Common mistakes

- **Using `any`** to silence errors; it disables checking everywhere the value flows. Prefer `unknown`
  and narrow it.
- **Overusing `as` assertions and the `!` non-null operator**, which hide real bugs.
- **Trusting API types** without validation; types are erased at run time.
- **Leaving `strict` off**, which lets `null` and `undefined` slip through.
- **Confusing `interface` and `type`**: both describe shapes. Interfaces can be extended and merged;
  `type` is needed for unions and mapped types. Pick one convention per codebase.
- **Expecting `enum` to be free**: enums generate runtime code; a union of string literals is often
  simpler.

## In interviews

Frontend and full-stack interviews ask about `interface` versus `type`, `any` versus `unknown` versus
`never`, generics (write a typed `groupBy` or `pick`), utility types (`Partial`, `Pick`, `Omit`,
`Record`, `ReturnType`), narrowing and discriminated unions, optional chaining (`?.`) and nullish
coalescing (`??`), and what TypeScript does **not** do at run time. In Angular roles, expect typed
reactive forms, typed HTTP calls and signals.

Likely follow-up questions:

- What happens to types when the code is compiled?
- When would you use `unknown` instead of `any`?
- How do discriminated unions make code safer?
- How would you type a function that returns the same type it receives?
