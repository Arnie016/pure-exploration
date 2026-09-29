const RECEIPT_SCHEMA_VERSION = 2;

function elapsedMs(receipt, atMs) {
  const startedAtMs = Date.parse(receipt.startedAt);
  return Number.isFinite(startedAtMs) ? Math.max(0, Math.round(atMs - startedAtMs)) : null;
}

function boundedText(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 160) : fallback;
}

export function createVoiceReceipt({ selectedId = null, activeExperiment = 'none', startedAtMs = Date.now() } = {}) {
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    state: 'requesting-permission',
    selectedId: boundedText(selectedId),
    activeExperiment: boundedText(activeExperiment, 'none'),
    model: null,
    startedAt: new Date(startedAtMs).toISOString(),
    stoppedAt: null,
    permission: 'requested',
    connectionLatencyMs: null,
    responseStartedLatencyMs: null,
    firstTranscriptLatencyMs: null,
    remoteAudioTrack: false,
    manualInterruptions: 0,
    voiceInterruptions: 0,
    interruptAcknowledged: false,
    usageSeconds: null,
    usageConfirmed: false,
    finalReason: null,
    durationMs: null,
    audioRecorded: false,
    transcriptPersisted: false,
    error: null
  };
}

export function advanceVoiceReceipt(receipt, event, atMs = Date.now()) {
  if (!receipt) return receipt;
  const next = { ...receipt };
  switch (event.type) {
    case 'permission-granted':
      next.permission = 'granted';
      next.state = 'connecting';
      break;
    case 'connected':
      next.state = 'live';
      next.model = boundedText(event.model, next.model);
      next.connectionLatencyMs ??= elapsedMs(next, atMs);
      break;
    case 'audio-track':
      next.remoteAudioTrack = true;
      break;
    case 'response-started':
      next.responseStartedLatencyMs ??= elapsedMs(next, atMs);
      break;
    case 'transcript-observed':
      next.firstTranscriptLatencyMs ??= elapsedMs(next, atMs);
      break;
    case 'manual-interrupt':
      next.manualInterruptions += 1;
      next.interruptAcknowledged = false;
      break;
    case 'voice-interrupt':
      next.voiceInterruptions += 1;
      next.interruptAcknowledged = false;
      break;
    case 'interrupt-acknowledged':
      next.interruptAcknowledged = true;
      break;
    case 'usage-updated':
      if (Number.isFinite(Number(event.seconds))) next.usageSeconds = Math.max(0, Number(event.seconds));
      break;
    case 'closed':
      next.state = 'stopped';
      next.stoppedAt = new Date(atMs).toISOString();
      next.durationMs = elapsedMs(next, atMs);
      if (Number.isFinite(Number(event.seconds))) next.usageSeconds = Math.max(0, Number(event.seconds));
      next.usageConfirmed = true;
      next.finalReason = boundedText(event.reason, 'closed');
      break;
    case 'stopped':
      next.state = 'stopped';
      next.stoppedAt = new Date(atMs).toISOString();
      next.durationMs = elapsedMs(next, atMs);
      break;
    case 'error':
      next.state = 'error';
      next.stoppedAt = new Date(atMs).toISOString();
      next.durationMs = elapsedMs(next, atMs);
      next.error = boundedText(event.message, 'Realtime session failed.');
      break;
    default:
      return receipt;
  }
  return next;
}

export function serializeVoiceReceipt(receipt) {
  if (!receipt) return '';
  const safeReceipt = {
    schemaVersion: receipt.schemaVersion,
    state: receipt.state,
    selectedId: receipt.selectedId,
    activeExperiment: receipt.activeExperiment,
    model: receipt.model,
    startedAt: receipt.startedAt,
    stoppedAt: receipt.stoppedAt,
    permission: receipt.permission,
    connectionLatencyMs: receipt.connectionLatencyMs,
    responseStartedLatencyMs: receipt.responseStartedLatencyMs,
    firstTranscriptLatencyMs: receipt.firstTranscriptLatencyMs,
    remoteAudioTrack: receipt.remoteAudioTrack,
    manualInterruptions: receipt.manualInterruptions,
    voiceInterruptions: receipt.voiceInterruptions,
    interruptAcknowledged: receipt.interruptAcknowledged,
    usageSeconds: receipt.usageSeconds,
    usageConfirmed: receipt.usageConfirmed,
    finalReason: receipt.finalReason,
    durationMs: receipt.durationMs,
    audioRecorded: false,
    transcriptPersisted: false,
    error: receipt.error
  };
  return JSON.stringify(safeReceipt, null, 2);
}
