import test from 'node:test';
import assert from 'node:assert/strict';
import { staleConflict, visibleState } from '../lib/server/service';
import { appendOnlyCommands, commandTargets, guardsFor, overwriteCommands } from '../lib/entity-guard';
import { commandArity, type Command } from '../lib/command-list';
import { seed } from '../lib/seed';
import * as rules from '../lib/rules';
import type { Actor } from '../lib/types';

const state = seed();
const advisorUser = state.users.find(u => u.role === 'advisor')!;
const advisor: Actor = { userId: advisorUser.id, name: advisorUser.name, role: 'advisor' };
const view = (s = state) => visibleState(s, advisor);
const cmd = (name: Command['name'], ...args: unknown[]): Command => ({ name, args });
const open = state.jobs.find(j => !['Teslim edildi', 'İptal'].includes(j.status))!;
const other = state.jobs.find(j => j.id !== open.id)!;

test('eşzamanlılık: üzerine yazan düzenlemeler eski revizyonla her zaman reddedilir', () => {
  for (const name of overwriteCommands) assert.ok(staleConflict(cmd(name), {}, view()), name);
});

test('eşzamanlılık: hedef iş emri değişmediyse komut güncel kayda uygulanır', () => {
  const c = cmd('moveJob', open.id, 'İşlemde', '');
  const guards = guardsFor([c], view());
  // Başka bir iş emri değişti: global revizyon arttı ama bu işlem etkilenmez.
  const changed = { ...state, jobs: state.jobs.map(j => j.id === other.id ? { ...j, complaintNote: 'x', promisedAt: '2030-01-01T00:00:00.000Z' } : j) };
  assert.equal(staleConflict(c, guards, view(changed)), null);
});

test('eşzamanlılık: hedef iş emri araya giren işlemle değiştiyse 409', () => {
  const pay = cmd('recordPayment', open.id, { key: 'k', amount: 100, method: 'Nakit', note: '' });
  const guards = guardsFor([pay], view());
  const paid = { ...state, jobs: state.jobs.map(j => j.id === open.id ? { ...j, payments: [...j.payments, { id: 'p-x', key: 'baska', amount: 100, method: 'Nakit' as const, note: '', at: '2026-01-01T00:00:00Z', by: 'B' }] } : j) };
  assert.match(staleConflict(pay, guards, view(paid)) ?? '', /iş emri/);
  // İptal edilmiş iş: eski ekrandan teklif gönderimi de reddedilir.
  const send = cmd('sendEstimate', open.id);
  const cancelled = { ...state, jobs: state.jobs.map(j => j.id === open.id ? { ...j, status: 'İptal' as const } : j) };
  assert.ok(staleConflict(send, guardsFor([send], view()), view(cancelled)));
});

test('eşzamanlılık: parmak izi alan sırasından bağımsızdır, eksik izde güvenli tarafta kalır', () => {
  const c = cmd('addInspection', open.id, {});
  const reordered = { ...state, jobs: state.jobs.map(j => j.id === open.id ? Object.fromEntries(Object.entries(j).reverse()) as typeof j : j) };
  assert.equal(staleConflict(c, guardsFor([c], view()), view(reordered)), null);
  assert.ok(staleConflict(c, {}, view()));
});

test('eşzamanlılık: yalnız ekleme yapan komutlar engellenmez', () => {
  for (const name of appendOnlyCommands) assert.equal(staleConflict(cmd(name, {}), {}, view()), null, name);
});

test('eşzamanlılık: her API komutu bilinçli olarak sınıflandırılmış', () => {
  // Yeni komut eklenince burada sınıflandırılmalı; aksi halde güvenli tarafta 409 alır.
  for (const name of Object.keys(commandArity) as Command['name'][]) {
    const kinds = [overwriteCommands.has(name), appendOnlyCommands.has(name), commandTargets(cmd(name, 'id-1', {})).length > 0 || name === 'openJob'].filter(Boolean).length;
    assert.equal(kinds, 1, name);
  }
});

test('kural: iptal edilmiş işte teklif gönderilemez ve karar verilemez', () => {
  const cancelled = { ...state, jobs: state.jobs.map(j => j.id === open.id ? { ...j, status: 'İptal' as const } : j) };
  assert.throws(() => rules.sendEstimate(cancelled, advisor, open.id), /İptal/);
  assert.throws(() => rules.decideEstimate(cancelled, advisor, open.id, 'e', 'Onaylandı', 'Telefon', 'Telefonda onay verdi'), /İptal/);
});
