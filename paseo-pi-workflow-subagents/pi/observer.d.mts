import type {
  StandaloneAgentStatus,
  WorkflowAgentStatus,
} from "../shared/subagents.js";

export interface PiWorkflowFetchRequestInit {
  method: "POST";
  headers: {
    Authorization: string;
    "Content-Type": "application/json";
  };
  body: string;
  redirect: "error";
  signal: AbortController["signal"];
}

export type PiWorkflowFetch = (
  input: string,
  init: PiWorkflowFetchRequestInit,
) => Promise<unknown>;

export type PiWorkflowIntervalHandle = NodeJS.Timeout | number;

export type PiWorkflowSetInterval = (
  callback: () => void,
  delay: number,
) => PiWorkflowIntervalHandle;

export type PiWorkflowClearInterval = (
  handle: PiWorkflowIntervalHandle,
) => void;

export interface PiWorkflowObserverOptions {
  pi: {
    events?: {
      on(
        channel: string,
        handler: (event: unknown) => void,
      ): (() => void) | undefined;
    };
  };
  piSessionId: string;
  bridgeUrl: string;
  bridgeToken: string;
  loadingRegistry: () => unknown;
  fetchImpl?: PiWorkflowFetch;
  now?: () => number;
  setIntervalImpl?: PiWorkflowSetInterval;
  clearIntervalImpl?: PiWorkflowClearInterval;
}

export interface PiWorkflowSubagentObserver {
  readonly active: boolean;
  stop(): void;
  flush(): Promise<void>;
}

export function projectWorkflowStatus(
  value: unknown,
  piSessionId: string,
  now?: () => number,
): WorkflowAgentStatus | undefined;

export function projectStandaloneStatus(
  value: unknown,
  request: unknown,
  piSessionId: string,
  now?: () => number,
): StandaloneAgentStatus | undefined;

export function startPiWorkflowSubagentObserver(
  options: PiWorkflowObserverOptions,
): PiWorkflowSubagentObserver;
