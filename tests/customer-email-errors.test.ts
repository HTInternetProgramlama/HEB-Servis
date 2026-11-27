import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthApiError } from '@supabase/supabase-js';
import { classifyCustomerEmailError, isTestCustomerEmail, isLocalCustomerEmailProvider } from '../lib/server/customer-email-errors';

// Synthetic markers only. No environment variables, provider connection or real secret is used.
const privateText = 'QA_SECRET_710 sb_secret_QA_ONLY smtp://user:QA_SMTP_PASSWORD@mail.example.invalid token=QA_RECOVERY_TOKEN recipient-private@example.invalid';
const expected = [
  ['email_address_not_authorized', 502],
  ['over_email_send_rate_limit', 429],
  ['over_request_rate_limit', 429],
  ['email_address_invalid', 422],
] as const;

function safeShape(value: ReturnType<typeof classifyCustomerEmailError>) {
  assert.deepEqual(Object.keys(value).sort(), ['code', 'message', 'status']);
  assert.equal(typeof value.code, 'string');
  assert.equal(typeof value.message, 'string');
  assert.ok(value.message.trim().length > 20, 'Kullanıcıya açıklayıcı bir mesaj dönmeli.');
  assert.ok(Number.isInteger(value.status));
  const serialized = JSON.stringify(value);
  for (const marker of ['QA_SECRET_710', 'sb_secret_QA_ONLY', 'QA_SMTP_PASSWORD', 'QA_RECOVERY_TOKEN', 'recipient-private@example.invalid', 'smtp://']) {
    assert.equal(serialized.includes(marker), false, 'Sağlayıcıya ait ham sır/URL/alıcı tanı çıktısına sızmamalı.');
  }
}

test('e-posta tanısı gerçek Supabase AuthApiError kodlarını doğru HTTP sınıfına dönüştürür', () => {
  for (const [code, status] of expected) {
    const result = classifyCustomerEmailError(new AuthApiError(privateText, 400, code));
    assert.equal(result.code, code);
    assert.equal(result.status, status);
    safeShape(result);
  }
});

test('bilinen alıcı yetkisi/geçersiz adres/gönderim limiti kodu kaba HTTP durumundan önceliklidir', () => {
  for (const [code, status] of expected) {
    const result = classifyCustomerEmailError({ code, status: 503, message: privateText });
    assert.equal(result.code, code);
    assert.equal(result.status, status);
  }
  assert.equal(classifyCustomerEmailError({ code: 'email_address_not_authorized', status: 429 }).status, 502);
  assert.equal(classifyCustomerEmailError({ code: 'email_address_invalid', status: 429 }).status, 422);
});

test('kodsuz veya bilinmeyen kodlu HTTP 429 güvenli istek limiti olarak sınıflanır', () => {
  for (const error of [{ status: 429 }, { status: 429, code: 'QA_SECRET_710', message: privateText }, new AuthApiError(privateText, 429, undefined)]) {
    const result = classifyCustomerEmailError(error);
    assert.equal(result.code, 'over_request_rate_limit');
    assert.equal(result.status, 429);
    safeShape(result);
  }
});

test('Auth unexpected_failure ve SMTP yapılandırma/bağlantı 5xx hataları teslim başarısı sayılmaz', () => {
  const errors = [
    new AuthApiError(privateText, 500, 'unexpected_failure'),
    { code: 'unexpected_failure', message: 'Error sending recovery email: ' + privateText },
    ...[500, 502, 503, 599].map(status => ({ status, message: 'SMTP configuration missing or connection failed: ' + privateText })),
  ];
  for (const error of errors) {
    const result = classifyCustomerEmailError(error);
    assert.equal(result.code, 'smtp_send_failed');
    assert.equal(result.status, 502);
    safeShape(result);
  }
});

test('SMTP yapılandırma tanısı ham hata metnine bağlı değildir ve kanıtlanmayan özel neden üretmez', () => {
  const first = classifyCustomerEmailError({ status: 500, message: 'SMTP password rejected ' + privateText });
  const second = classifyCustomerEmailError({ status: 500, message: 'Provider unavailable ' + privateText });
  assert.deepEqual(first, second);
  assert.match(first.message, /SMTP|gönderim/i);
  safeShape(first);
  // A raw English provider message without a trusted code/status is still unknown.
  assert.equal(classifyCustomerEmailError(new Error('SMTP configuration failure ' + privateText)).code, 'email_delivery_unknown');
});

test('unknown/primitive/secret içeren nesneler yalnız sabit bilinmeyen-hata tanısı döndürür', () => {
  const baseline = classifyCustomerEmailError(null);
  assert.equal(baseline.code, 'email_delivery_unknown');
  assert.equal(baseline.status, 502);
  const inputs: unknown[] = [undefined, false, 0, privateText, [], new Error(privateText),
    { code: privateText, status: 400, message: privateText, stack: privateText, cause: { password: privateText } },
    { code: 'email_address_not_authorized ' + privateText, status: 403 },
    { code: ['email_address_invalid'], status: '429', message: privateText },
  ];
  for (const input of inputs) {
    const result = classifyCustomerEmailError(input);
    assert.deepEqual(result, baseline);
    safeShape(result);
  }
});

test('hata nesnesindeki getter exception tanı akışını bozamaz veya sırrı dışarı taşıyamaz', () => {
  for (const property of ['code', 'status']) {
    const error = Object.defineProperty({}, property, { get() { throw new Error(privateText); } });
    const result = classifyCustomerEmailError(error);
    assert.equal(result.code, 'email_delivery_unknown');
    assert.equal(result.status, 502);
    safeShape(result);
  }
});

test('sınıflandırıcı ham message/stack okumadan bilinen kodu işler', () => {
  const error = { code: 'email_address_not_authorized', status: 403 };
  for (const property of ['message', 'stack']) Object.defineProperty(error, property, { get() { throw new Error(privateText); } });
  const result = classifyCustomerEmailError(error);
  assert.equal(result.code, 'email_address_not_authorized');
  assert.equal(result.status, 502);
  safeShape(result);
});

test('sağlayıcı kodu için prototype anahtarları izinli tanı kodu olarak kullanılamaz', () => {
  for (const code of ['__proto__', 'constructor', 'prototype', 'toString', 'smtp_send_failed', 'email_delivery_unknown']) {
    const result = classifyCustomerEmailError({ code, status: 400, message: privateText });
    assert.equal(result.code, 'email_delivery_unknown');
    safeShape(result);
  }
});

test('tanı nesnesi inputtan bağımsızdır; önceki yanıtın değiştirilmesi sonraki mesajı kirletmez', () => {
  const error = Object.freeze({ code: 'email_address_invalid', status: 400, message: privateText });
  const first = classifyCustomerEmailError(error);
  const clean = classifyCustomerEmailError(error);
  first.message = privateText;
  const again = classifyCustomerEmailError(error);
  assert.deepEqual(again, clean);
  safeShape(again);
});

test('.test alan adı tanısı alt alan/case/son noktayı tanır, gerçek görünümlü farklı alanı bloklamaz', () => {
  for (const email of ['qa@example.test', 'qa@sub.example.test', ' QA@EXAMPLE.TEST ', 'qa@example.test.']) assert.equal(isTestCustomerEmail(email), true);
  for (const email of ['qa@example.com', 'qa@test.example.com', 'qa@example.test.com', 'test@example.org']) assert.equal(isTestCustomerEmail(email), false);
});

test('yerel Mailpit istisnası yalnız HTTP(S) loopback hostlarını kabul eder; bulut/aldatıcı alanı kabul etmez', () => {
  for (const url of ['http://localhost:54321', 'http://127.0.0.1:54321', 'http://[::1]:54321', 'https://localhost:54321']) assert.equal(isLocalCustomerEmailProvider(url), true);
  for (const url of [undefined, '', 'not-a-url', 'https://example.supabase.co', 'https://localhost.example.com', 'https://127.0.0.1.example.com', 'https://localhost@example.com', 'ftp://localhost:54321']) assert.equal(isLocalCustomerEmailProvider(url), false);
});
