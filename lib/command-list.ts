// Only these mutations are exposed by the API. Numbers exclude state/actor and optional clock.
export const commandArity = {
  addCustomer: 1, updateCustomer: 2, addVehicle: 1, updateVehicle: 2,
  requestAppointment: 1, confirmAppointment: 1, rescheduleAppointment: 2, setAppointmentStatus: 2,
  openJob: 1, moveJob: 3, reassignJob: 2, addInspection: 2, toggleInspectionVisibility: 2,
  createEstimateDraft: 1, upsertLine: 3, removeLine: 2, setEstimateNote: 2,
  sendEstimate: 1, decideEstimate: 5, recordPayment: 2, deliverJob: 2,
  addNote: 1, editNote: 2, evaluateVisit: 1, upsertCatalog: 2, logReminder: 1,
  updateSettings: 1, upsertUser: 2,
} as const;
export type CommandName = keyof typeof commandArity;
export interface Command { name: CommandName; args: unknown[] }
