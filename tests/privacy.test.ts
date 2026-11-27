import test from 'node:test';
import assert from 'node:assert/strict';
import { maskPersonal } from '../lib/privacy';

test('maskeleme: telefon, e-posta, kimlik no, IBAN ve plaka modele gitmez', () => {
  const out = maskPersonal('Beni 0532 123 45 67 ya da +90 555 987 6543 arayın, ali@ornek.com. TC 10000000146, IBAN TR12 0006 1005 1978 6457 8413 26. Plaka 34 ABC 123 ve 06AB1234.');
  for (const leak of ['0532', '987 6543', 'ali@', '10000000146', 'TR12', '34 ABC', '06AB']) assert.ok(!out.includes(leak), `${leak} sızdı: ${out}`);
  for (const label of ['[TELEFON]', '[E-POSTA]', '[KİMLİK NO]', '[IBAN]', '[PLAKA]']) assert.ok(out.includes(label), label);
});

test('maskeleme: teknik bilgi bozulmaz, bilinen adlar gizlenir', () => {
  const text = "98.000 km'de frenlerken sağa çekiyor, 2019 model, OBD P0300 kodu. Ahmet Yılmaz'ın aracı, Ahmet bey bekliyor.";
  const out = maskPersonal(text, ['Ahmet Yılmaz']);
  assert.ok(out.includes('98.000 km') && out.includes('2019 model') && out.includes('P0300'), out);
  assert.ok(!/Ahmet|Yılmaz/.test(out), out);
  assert.ok(out.includes("[KİŞİ]'ın aracı"), out);
});

test('maskeleme: parça/teknik kodlar korunur, nokta ayraçlı telefon yakalanır', () => {
  const text = 'Parça no 11617559523 ve 3138200030, VW 03L 906 023 enjektör, CAN-bus hatası, kontak 2. kademe. Tel 0532.123.45.67';
  const out = maskPersonal(text, ['Can Demir']);
  for (const keep of ['11617559523', '3138200030', '03L 906 023', 'CAN-bus']) assert.ok(out.includes(keep), `${keep} bozuldu: ${out}`);
  assert.ok(out.includes('[TELEFON]') && !out.includes('0532'), out);
  assert.ok(maskPersonal('Can Bey aradı', ['Can Demir']).startsWith('[KİŞİ]'));
  assert.ok(maskPersonal('DEMİR beyin aracı', ['Can Demir']).startsWith('[KİŞİ]'));
});

test('maskeleme: geçerli T.C. kimlik no sağlamalı tanınır', async () => {
  const { isTcKimlik } = await import('../lib/privacy');
  assert.equal(isTcKimlik('10000000146'), true);
  assert.equal(isTcKimlik('11617559523'), false);
  assert.ok(maskPersonal('TC 10000000146').includes('[KİMLİK NO]'));
});
