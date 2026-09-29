export const SYSTEM_WORKSPACE_SCHEMA_VERSION = 1;
export const SYSTEM_WORKSPACE_LIMIT = 24;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertId(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(value)) {
    throw new Error(`${label} must be a stable lowercase id`);
  }
}

function assertState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.bodies)) throw new Error('System document state requires a body array');
  if (!Number.isFinite(state.timeSeconds) || state.timeSeconds < 0) throw new Error('System document time must be non-negative');
  if (!Number.isFinite(state.stepSeconds) || state.stepSeconds <= 0) throw new Error('System document step must be positive');
  if (!state.cameraOrbit || !Number.isFinite(state.cameraOrbit.zoom)) throw new Error('System document requires a camera state');
}

export function createSystemDocument({ id, name, state, source = 'local' }) {
  assertId(id, 'System id');
  if (typeof name !== 'string' || !name.trim() || name.length > 64) throw new Error('System name must be 1–64 characters');
  assertState(state);
  return {
    schemaVersion: SYSTEM_WORKSPACE_SCHEMA_VERSION,
    id,
    name: name.trim(),
    source,
    revision: 0,
    state: clone(state)
  };
}

export function createSystemWorkspace({ documents, activeId }) {
  if (!Array.isArray(documents) || documents.length === 0 || documents.length > SYSTEM_WORKSPACE_LIMIT) throw new Error(`Workspace requires 1–${SYSTEM_WORKSPACE_LIMIT} systems`);
  const ids = new Set();
  const normalized = documents.map((document) => {
    const candidate = createSystemDocument(document);
    candidate.revision = Number.isInteger(document.revision) && document.revision >= 0 ? document.revision : 0;
    if (ids.has(candidate.id)) throw new Error(`Duplicate system id: ${candidate.id}`);
    ids.add(candidate.id);
    return candidate;
  });
  assertId(activeId, 'Active system id');
  if (!ids.has(activeId)) throw new Error('Active system is missing');
  return { schemaVersion: SYSTEM_WORKSPACE_SCHEMA_VERSION, activeId, documents: normalized };
}

export function activeSystemDocument(workspace) {
  return workspace.documents.find((document) => document.id === workspace.activeId) || null;
}

export function replaceActiveSystemState(workspace, state) {
  assertState(state);
  const next = clone(workspace);
  const active = activeSystemDocument(next);
  if (!active) throw new Error('Active system is missing');
  active.state = clone(state);
  active.revision += 1;
  return next;
}

export function addSystemDocument(workspace, document, { activate = true } = {}) {
  if (workspace.documents.length >= SYSTEM_WORKSPACE_LIMIT) throw new Error(`Workspace limit is ${SYSTEM_WORKSPACE_LIMIT} systems`);
  const candidate = createSystemDocument(document);
  if (workspace.documents.some((entry) => entry.id === candidate.id)) throw new Error(`Duplicate system id: ${candidate.id}`);
  const next = clone(workspace);
  next.documents.push(candidate);
  if (activate) next.activeId = candidate.id;
  return next;
}

export function switchSystemDocument(workspace, nextId, currentState) {
  assertId(nextId, 'Target system id');
  if (!workspace.documents.some((document) => document.id === nextId)) throw new Error(`Unknown system: ${nextId}`);
  let next = replaceActiveSystemState(workspace, currentState);
  next.activeId = nextId;
  return { workspace: next, state: clone(activeSystemDocument(next).state) };
}

export function serializeSystemWorkspace(workspace) {
  return JSON.stringify(createSystemWorkspace(workspace));
}

export function parseSystemWorkspace(serialized, fallback) {
  if (!serialized) return clone(fallback);
  try {
    return createSystemWorkspace(JSON.parse(serialized));
  } catch {
    return clone(fallback);
  }
}
