import { streamTutorReply } from './tutor-stream';

async function first(gen: AsyncGenerator<unknown>) {
  return (await gen.next()).value;
}

describe('streamTutorReply errors before the stream starts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explains the daily limit with the reset time in your own time zone', async () => {
    const resetAt = '2026-11-14T00:00:00+00:00';
    vi.stubGlobal('fetch', async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'tutor_limit_reached',
            message: 'server text',
            details: { limit: 30, reset_at: resetAt },
          },
        }),
        { status: 429 },
      ),
    );
    const local = new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(await first(streamTutorReply('s', 'hi'))).toEqual({
      type: 'error',
      code: 'tutor_limit_reached',
      message: `You've used today's 30 tutor messages. More at ${local}.`,
    });
  });

  it('keeps the server message for other errors', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ error: { code: 'session_not_found', message: 'No such chat' } }), {
        status: 404,
      }),
    );
    expect(await first(streamTutorReply('s', 'hi'))).toEqual({
      type: 'error',
      code: 'session_not_found',
      message: 'No such chat',
    });
  });
});
