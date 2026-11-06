import { Topic, Track } from '../../core/api/models';

export const NODE_W = 200;
export const NODE_H = 42;
const COL_GAP = 72;
const ROW_GAP = 14;
const PAD = 24;

const TRACK_ORDER: Track[] = ['dsa', 'languages', 'frameworks', 'ai', 'system-design'];

export interface PlacedNode {
  topic: Topic;
  x: number;
  y: number;
  depth: number;
}

export interface PlacedEdge {
  source: string;
  target: string;
  path: string;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

/**
 * Layered graph layout:
 * 1. Column = prerequisite depth (longest path from a starting topic).
 * 2. Inside a column, order by the average row of each topic's prerequisites
 *    (the "barycenter" heuristic), which keeps lines short and reduces crossings.
 */
export function layoutGraph(topics: Topic[], edges: { source: string; target: string }[]): Layout {
  const requires = new Map<string, string[]>(topics.map((t) => [t.id, []]));
  for (const e of edges) requires.get(e.target)?.push(e.source);

  const depth = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; // cycles are rejected by the backend; guard anyway
    seen.add(id);
    const reqs = requires.get(id) ?? [];
    const d = reqs.length ? 1 + Math.max(...reqs.map((r) => depthOf(r, seen))) : 0;
    depth.set(id, d);
    return d;
  };
  topics.forEach((t) => depthOf(t.id));

  const columns: Topic[][] = [];
  for (const t of topics) (columns[depth.get(t.id)!] ??= []).push(t);

  const row = new Map<string, number>();
  const order = new Map(topics.map((t, i) => [t.id, i]));
  columns.forEach((col, d) => {
    const score = (t: Topic) => {
      const reqs = requires.get(t.id) ?? [];
      if (d === 0 || !reqs.length) return TRACK_ORDER.indexOf(t.track) * 100 + order.get(t.id)!;
      return reqs.reduce((s, r) => s + (row.get(r) ?? 0), 0) / reqs.length;
    };
    col.sort((a, b) => score(a) - score(b) || order.get(a.id)! - order.get(b.id)!);
    col.forEach((t, i) => row.set(t.id, i));
  });

  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
  const nodes: PlacedNode[] = [];
  columns.forEach((col, d) => {
    const colHeight = col.length * NODE_H + (col.length - 1) * ROW_GAP;
    const top = (height - colHeight) / 2; // centre each column vertically
    col.forEach((t, i) =>
      nodes.push({ topic: t, depth: d, x: PAD + d * (NODE_W + COL_GAP), y: top + i * (NODE_H + ROW_GAP) }),
    );
  });

  const pos = new Map(nodes.map((n) => [n.topic.id, n]));
  const placedEdges: PlacedEdge[] = edges
    .filter((e) => pos.has(e.source) && pos.has(e.target))
    .map((e) => {
      const a = pos.get(e.source)!;
      const b = pos.get(e.target)!;
      const x1 = a.x + NODE_W;
      const y1 = a.y + NODE_H / 2;
      const x2 = b.x;
      const y2 = b.y + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      return { ...e, path: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}` };
    });

  return {
    nodes,
    edges: placedEdges,
    width: PAD * 2 + columns.length * NODE_W + (columns.length - 1) * COL_GAP,
    height,
  };
}
