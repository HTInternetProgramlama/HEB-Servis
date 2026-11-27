import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { deepseek } from '../lib/server/ai';

const schema = z.object({ answer: z.string() });
function withFetch(replies: (() => Response)[], run: (calls: RequestInit[]) => Promise<void>) {
  const original = globalThis.fetch; const calls: RequestInit[] = []; let i = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => { calls.push(init); return replies[Math.min(i++, replies.length - 1)]() }) as typeof fetch;
  return run(calls).finally(() => { globalThis.fetch = original });
}
const ok = (content: string, finish = 'stop') => () => Response.json({ model: 'deepseek-flash', usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [{ finish_reason: finish, message: { content } }] });

test('DeepSeek: anahtar yoksa veya yer tutucuysa sağlayıcı kapalıdır', () => {
  delete process.env.DEEPSEEK_API_KEY; assert.equal(deepseek(), null);
  process.env.DEEPSEEK_API_KEY = 'BURAYA_DEEPSEEK_ANAHTARI'; assert.equal(deepseek(), null);
});

test('DeepSeek: JSON kipi, şema doğrulama ve anahtarın yalnız başlıkta gitmesi', async () => {
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  await withFetch([ok('{"answer":"tamam"}')], async calls => {
    const r = await deepseek()!.run('sistem', 'soru', schema, 100, 'low');
    assert.deepEqual(r.data, { answer: 'tamam' });
    const body = JSON.parse(String(calls[0].body));
    assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[0].content, /JSON/);
    assert.equal((calls[0].headers as Record<string, string>).Authorization, 'Bearer sk-test');
    assert.ok(!String(calls[0].body).includes('sk-test'));
  });
});

test('DeepSeek: geçersiz cevapta bir kez yeniden dener, token toplar', async () => {
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  await withFetch([ok('{"yanlis":1}'), ok('{"answer":"ikinci"}')], async calls => {
    const r = await deepseek()!.run('s', 'p', schema, 100, 'low');
    assert.equal(calls.length, 2); assert.equal(r.data?.answer, 'ikinci'); assert.equal(r.input, 20);
  });
  await withFetch([ok('{"answer":"yarim', 'length')], async () => {
    assert.equal((await deepseek()!.run('s', 'p', schema, 100, 'low')).data, null);
  });
});

test('DeepSeek: HTTP hataları sınıflandırılır', async () => {
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  for (const [status, kind] of [[401, 'auth'], [402, 'balance'], [429, 'busy'], [503, 'busy']] as const)
    await withFetch([() => new Response('{}', { status })], async () => {
      await assert.rejects(deepseek()!.run('s', 'p', schema, 100, 'low'), (e: Error) => e.message === kind);
    });
});
