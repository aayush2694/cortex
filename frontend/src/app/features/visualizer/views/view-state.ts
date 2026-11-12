import { Frame } from '../../../core/api/models';

/** A named value shown as a pill under a view ("target = 9"). */
export interface Var {
  name: string;
  value: string;
}

/** A labelled list shown beside a view: a queue, a stack, a heap. */
export interface Panel {
  label: string;
  items: (string | number)[];
}

/**
 * The one place a view trusts the server's frame state to have its shape.
 * Each view declares the fields it reads; everything after this is type-checked.
 */
export function stateOf<T>(frame: Frame): Partial<T> {
  return frame.state as Partial<T>;
}
