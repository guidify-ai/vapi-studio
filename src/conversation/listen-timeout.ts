/**
 * How long the channel waits after a user pause before closing a listen.
 *
 * Vapi's default `onPunctuationSeconds` is 0.1 — a transcribed "K." ends the
 * turn before "as soon as possible" lands. RA9's default is long enough to
 * catch trailing speech; Nodes override via `listenTimeoutSeconds`.
 */

/** Default listen window in seconds (Node class + channel hold). */
export const DEFAULT_LISTEN_TIMEOUT_SECONDS = 2.5;

/** Shortest listen window (Vapi waitSeconds floor is 0.4). */
export const MIN_LISTEN_TIMEOUT_SECONDS = 0.4;

/** Longest listen window — long dictation (address) needs room after pauses. */
export const MAX_LISTEN_TIMEOUT_SECONDS = 12;

export function clampListenTimeoutSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LISTEN_TIMEOUT_SECONDS;
  }
  return Math.min(
    MAX_LISTEN_TIMEOUT_SECONDS,
    Math.max(MIN_LISTEN_TIMEOUT_SECONDS, value),
  );
}

/**
 * Resolve listen timeout: sayAndListen → listen() → Node class → default.
 */
export function resolveListenTimeoutSeconds(input: {
  fromSayAndListen?: number;
  fromListen?: number;
  fromNode?: number;
}): number {
  const raw =
    input.fromSayAndListen ??
    input.fromListen ??
    input.fromNode ??
    DEFAULT_LISTEN_TIMEOUT_SECONDS;
  return clampListenTimeoutSeconds(raw);
}

export function listenTimeoutSecondsToMs(
  timeoutSeconds: number | undefined,
): number {
  return Math.round(
    clampListenTimeoutSeconds(
      timeoutSeconds ?? DEFAULT_LISTEN_TIMEOUT_SECONDS,
    ) * 1000,
  );
}

/** Vapi `startSpeakingPlan` fragment for a listen timeout (seconds). */
export interface VapiStartSpeakingPlanFromListenTimeout {
  customEndpointingRules: Array<{
    type: 'assistant';
    regex: string;
    timeoutSeconds: number;
  }>;
  transcriptionEndpointingPlan: {
    onPunctuationSeconds: number;
    onNoPunctuationSeconds: number;
    onNumberSeconds: number;
  };
}

/**
 * Map a listen timeout onto Vapi endpointing so punctuation like "K." does
 * not close the user turn at the 0.1s default.
 */
export function listenTimeoutToVapiStartSpeakingPlan(
  timeoutSeconds: number = DEFAULT_LISTEN_TIMEOUT_SECONDS,
): VapiStartSpeakingPlanFromListenTimeout {
  const seconds = clampListenTimeoutSeconds(timeoutSeconds);
  return {
    customEndpointingRules: [
      { type: 'assistant', regex: '.', timeoutSeconds: seconds },
    ],
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: seconds,
      onNoPunctuationSeconds: seconds,
      onNumberSeconds: seconds,
    },
  };
}
