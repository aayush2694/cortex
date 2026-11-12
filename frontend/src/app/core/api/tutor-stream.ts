import { API } from './api';

export type TutorEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string }
  | { type: 'refused'; message: string }
  | { type: 'error'; code: string; message: string };

/**
 * Send a message and read the reply as Server-Sent Events.
 * Uses fetch (not EventSource) because the request is a POST with a JSON body.
 */
export async function* streamTutorReply(
  sessionId: string,
  text: string,
  signal?: AbortSignal,
): AsyncGenerator<TutorEvent> {
  const res = await fetch(`${API}/tutor/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!res.ok || !res.body) {
    let code = 'http_error';
    let message = `Request failed (${res.status})`;
    try {
      const err = (await res.json()).error;
      code = err?.code ?? code;
      message = err?.message ?? message;
      if (code === 'tutor_limit_reached' && err.details?.reset_at) {
        // Show when the allowance resets in your own time zone, not the server's.
        const at = new Date(err.details.reset_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const n = err.details.limit;
        message = `You've used today's ${n} tutor ${n === 1 ? 'message' : 'messages'}. More at ${at}.`;
      }
    } catch {
      // not JSON
    }
    yield { type: 'error', code, message };
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let split: number;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = parseEvent(chunk);
      if (event) yield event;
    }
  }
}

function parseEvent(chunk: string): TutorEvent | null {
  let name = 'message';
  let data = '';
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  const payload = JSON.parse(data);
  switch (name) {
    case 'delta':
      return { type: 'delta', text: payload.text };
    case 'done':
      return { type: 'done', messageId: payload.message_id };
    case 'refused':
      return { type: 'refused', message: payload.message };
    case 'error':
      return { type: 'error', code: payload.code, message: payload.message };
    default:
      return null;
  }
}
