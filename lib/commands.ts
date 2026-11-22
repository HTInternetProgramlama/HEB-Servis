'use client';
// Existing UI callbacks are collected synchronously; the server executes each command
// against authoritative state. Replay only updates callback result IDs after commit.
import * as rules from './rules';
import type { Actor, State } from './types';
import type { Command } from './command-list';
export * from './rules';
let context: { commands: Command[]; replay?: State } | undefined;
function wrap<K extends keyof typeof rules>(name: K): typeof rules[K] {
  return ((state: State, actor: Actor, ...args: unknown[]) => {
    if (!context) throw new Error('Değişiklikler run içinde yapılmalı.');
    if (context.replay) return context.replay;
    context.commands.push({ name: name as Command['name'], args });
    return (rules[name] as unknown as (s: State, a: Actor, ...args: unknown[]) => State)(state, actor, ...args);
  }) as typeof rules[K];
}
export function collect(change: (s: State, a: Actor) => State, state: State, actor: Actor) {
  const commands: Command[] = [];
  context = { commands };
  try { change(state, actor); return commands; } finally { context = undefined; }
}
export function replay(change: (s: State, a: Actor) => State, state: State, actor: Actor) {
  context = { commands: [], replay: state };
  try { change(state, actor); } finally { context = undefined; }
}
export const addCustomer = wrap('addCustomer');
export const updateCustomer = wrap('updateCustomer');
export const addVehicle = wrap('addVehicle');
export const updateVehicle = wrap('updateVehicle');
export const requestAppointment = wrap('requestAppointment');
export const confirmAppointment = wrap('confirmAppointment');
export const rescheduleAppointment = wrap('rescheduleAppointment');
export const setAppointmentStatus = wrap('setAppointmentStatus');
export const openJob = wrap('openJob');
export const moveJob = wrap('moveJob');
export const reassignJob = wrap('reassignJob');
export const addInspection = wrap('addInspection');
export const toggleInspectionVisibility = wrap('toggleInspectionVisibility');
export const createEstimateDraft = wrap('createEstimateDraft');
export const upsertLine = wrap('upsertLine');
export const removeLine = wrap('removeLine');
export const setEstimateNote = wrap('setEstimateNote');
export const sendEstimate = wrap('sendEstimate');
export const decideEstimate = wrap('decideEstimate');
export const recordPayment = wrap('recordPayment');
export const deliverJob = wrap('deliverJob');
export const addNote = wrap('addNote');
export const editNote = wrap('editNote');
export const evaluateVisit = wrap('evaluateVisit');
export const upsertCatalog = wrap('upsertCatalog');
export const logReminder = wrap('logReminder');
export const updateSettings = wrap('updateSettings');
export const upsertUser = wrap('upsertUser');
