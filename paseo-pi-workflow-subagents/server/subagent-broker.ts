import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import type { AddressInfo } from "node:net";
import {
  MAX_AGENT_COUNT,
  MAX_STATUS_BUFFER_LENGTH,
  MAX_WATCH_UPDATE_COUNT,
  MONITORING_AVAILABILITY,
  WATCH_LONG_POLL_TIMEOUT_MS,
  companionMessageSchema,
  type AgentAvailability,
  type CompanionMessage,
  type SequencedAgentStatus,
  type SubagentStatus,
  type WatchSubagentsInput,
  type WatchSubagentsOutput,
} from "../shared/subagents.ts";

const LOOPBACK_HOST = "127.0.0.1";
const MAX_BRIDGE_BODY_BYTES = 64 * 1024;
const STALE_TIMEOUT_MS = 30_000;
const MAX_SESSIONS_PER_PARENT = 8;
const MAX_WATCHERS_PER_SESSION = 64;
const MAX_WATCHERS_PER_PARENT = 64;

type TimerHandle = ReturnType<typeof setNodeTimeout>;
type Availability = AgentAvailability;
type Wake = () => void;

interface BrokerOptions {
  createToken(): string;
  now(): Date;
  scheduleTimeout(callback: () => void, delayMs: number): TimerHandle;
  cancelTimeout(handle: TimerHandle): void;
  staleTimeoutMs: number;
  watchTimeoutMs: number;
  statusBufferLength: number;
  maxWatchersPerSession: number;
}

interface BrokerOptionOverrides {
  createToken?: () => string;
  now?: () => Date;
  scheduleTimeout?: (callback: () => void, delayMs: number) => TimerHandle;
  cancelTimeout?: (handle: TimerHandle) => void;
  staleTimeoutMs?: number;
  watchTimeoutMs?: number;
  statusBufferLength?: number;
  maxWatchersPerSession?: number;
}

interface ParentRegistration {
  parentAgentId: string;
  piSessionId: string | null;
}

interface SessionState {
  parentAgentId: string;
  piSessionId: string;
  availability: Availability;
  unsupportedCode: string | null;
  lastHeartbeatAt: string | null;
  lastActivityMs: number;
  cursor: number;
  revision: number;
  agents: Map<string, SubagentStatus>;
  updates: SequencedAgentStatus[];
  waiters: Set<Wake>;
  staleTimer: TimerHandle | undefined;
  deleted: boolean;
}

class BridgeRequestError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const defaultOptions: BrokerOptions = {
  createToken: () => randomBytes(32).toString("hex"),
  now: () => new Date(),
  scheduleTimeout: (callback, delayMs) => setNodeTimeout(callback, delayMs),
  cancelTimeout: (handle) => clearNodeTimeout(handle),
  staleTimeoutMs: STALE_TIMEOUT_MS,
  watchTimeoutMs: WATCH_LONG_POLL_TIMEOUT_MS,
  statusBufferLength: MAX_STATUS_BUFFER_LENGTH,
  maxWatchersPerSession: MAX_WATCHERS_PER_SESSION,
};

export class SubagentBroker {
  private readonly options: BrokerOptions;
  private readonly server: Server;
  private readonly registrationsByToken = new Map<string, ParentRegistration>();
  private readonly tokenByParent = new Map<string, string>();
  private readonly sessionsByParent = new Map<
    string,
    Map<string, SessionState>
  >();
  private readonly currentSessionByParent = new Map<string, string>();
  private readonly pendingSessionByParent = new Set<string>();
  private readonly parentWaitersByParent = new Map<string, Set<Wake>>();
  private listenPromise: Promise<string> | undefined;
  private closed = false;

  constructor(overrides: Partial<BrokerOptionOverrides> = {}) {
    this.options = { ...defaultOptions, ...overrides };
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  start(): void {
    if (this.listenPromise !== undefined) {
      throw new Error("Sub-agent broker is already started.");
    }
    this.listenPromise = new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, LOOPBACK_HOST, () => {
        this.server.off("error", reject);
        const address = this.server.address();
        if (address === null || typeof address === "string") {
          reject(new Error("Sub-agent broker did not receive a TCP address."));
          return;
        }
        resolve(
          "http://" + LOOPBACK_HOST + ":" + (address as AddressInfo).port,
        );
      });
    });
    // The startup error is observed by getUrl() when a session hook needs it.
    void this.listenPromise.catch(() => undefined);
  }

  getUrl(): Promise<string> {
    if (this.listenPromise === undefined) {
      throw new Error("Sub-agent broker has not been started.");
    }
    return this.listenPromise;
  }

  registerAgent(parentAgentId: string): string {
    if (this.closed) {
      throw new Error("Sub-agent broker is closed.");
    }

    const previousToken = this.tokenByParent.get(parentAgentId);
    if (previousToken !== undefined) {
      const previous = this.registrationsByToken.get(previousToken);
      this.registrationsByToken.delete(previousToken);
      if (
        previous?.piSessionId !== null &&
        previous?.piSessionId !== undefined
      ) {
        const oldState = this.getSession(parentAgentId, previous.piSessionId);
        if (oldState !== undefined) {
          this.setAvailability(oldState, MONITORING_AVAILABILITY.STALE);
        }
      }
    }

    const token = this.options.createToken();
    if (token.length === 0 || this.registrationsByToken.has(token)) {
      throw new Error(
        "Sub-agent broker generated an invalid or duplicate token.",
      );
    }
    this.currentSessionByParent.delete(parentAgentId);
    this.pendingSessionByParent.add(parentAgentId);
    this.tokenByParent.set(parentAgentId, token);
    this.registrationsByToken.set(token, {
      parentAgentId,
      piSessionId: null,
    });
    return token;
  }

  unregisterAgent(parentAgentId: string): void {
    const token = this.tokenByParent.get(parentAgentId);
    if (token !== undefined) {
      this.tokenByParent.delete(parentAgentId);
      this.registrationsByToken.delete(token);
    }

    const sessions = this.sessionsByParent.get(parentAgentId);
    if (sessions !== undefined) {
      for (const state of sessions.values()) {
        this.deleteSessionState(state);
      }
      this.sessionsByParent.delete(parentAgentId);
    }
    this.currentSessionByParent.delete(parentAgentId);
    this.pendingSessionByParent.delete(parentAgentId);
    this.notifyParentWaiters(parentAgentId);
  }

  async watch(input: WatchSubagentsInput): Promise<WatchSubagentsOutput> {
    if (this.closed) {
      return this.unavailable(input.parentAgentId);
    }

    let currentSessionId = this.currentSessionByParent.get(input.parentAgentId);
    if (
      currentSessionId === undefined &&
      this.pendingSessionByParent.has(input.parentAgentId)
    ) {
      if (input.cursor === undefined) {
        return this.unavailable(input.parentAgentId);
      }
      if (
        (this.parentWaitersByParent.get(input.parentAgentId)?.size ?? 0) >=
        MAX_WATCHERS_PER_PARENT
      ) {
        throw new BridgeRequestError(
          429,
          "The parent has reached its pending-session watcher limit.",
        );
      }
      await this.waitForParentSession(input.parentAgentId);
      if (this.closed) {
        return this.unavailable(input.parentAgentId);
      }
      currentSessionId = this.currentSessionByParent.get(input.parentAgentId);
      if (currentSessionId === undefined) {
        return this.unavailable(input.parentAgentId);
      }
      const currentState = this.getSession(
        input.parentAgentId,
        currentSessionId,
      );
      return currentState === undefined
        ? this.unavailable(input.parentAgentId)
        : this.snapshotResponse(currentState, false);
    }
    const isFollowingFormerSession =
      input.piSessionId !== undefined &&
      currentSessionId !== undefined &&
      input.piSessionId !== currentSessionId;
    const piSessionId = isFollowingFormerSession
      ? currentSessionId
      : (input.piSessionId ?? currentSessionId);
    if (piSessionId === undefined) {
      return this.unavailable(input.parentAgentId);
    }

    const state = this.getSession(input.parentAgentId, piSessionId);
    if (state === undefined || state.deleted) {
      return this.unavailable(input.parentAgentId);
    }
    if (input.cursor === undefined || isFollowingFormerSession) {
      return this.snapshotResponse(state, false);
    }

    const immediate = this.responseAfterCursor(
      state,
      input.cursor,
      state.revision,
    );
    if (immediate !== null) {
      return immediate;
    }
    if (state.waiters.size >= this.options.maxWatchersPerSession) {
      throw new BridgeRequestError(
        429,
        "The Pi session has reached its watcher limit.",
      );
    }

    const revision = state.revision;
    await this.waitForChange(state);
    if (this.closed) {
      return this.unavailable(input.parentAgentId);
    }

    const liveState = this.getSession(input.parentAgentId, piSessionId);
    if (liveState === undefined || liveState.deleted) {
      return this.unavailable(input.parentAgentId);
    }
    return (
      this.responseAfterCursor(liveState, input.cursor, revision) ?? {
        parentAgentId: liveState.parentAgentId,
        piSessionId: liveState.piSessionId,
        availability: liveState.availability,
        cursor: liveState.cursor,
        gap: false,
        snapshot: null,
        updates: [],
      }
    );
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const sessions of this.sessionsByParent.values()) {
      for (const state of sessions.values()) {
        this.deleteSessionState(state);
      }
    }
    this.registrationsByToken.clear();
    this.tokenByParent.clear();
    this.sessionsByParent.clear();
    this.currentSessionByParent.clear();
    for (const parentAgentId of this.parentWaitersByParent.keys()) {
      this.notifyParentWaiters(parentAgentId);
    }
    this.pendingSessionByParent.clear();

    if (this.listenPromise !== undefined) {
      try {
        await this.listenPromise;
      } catch {
        return;
      }
    }
    if (!this.server.listening) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(
            new Error("Failed to close the sub-agent broker.", {
              cause: error,
            }),
          );
          return;
        }
        resolve();
      });
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      if (request.url !== "/status") {
        this.sendJson(response, 404, { error: "Not found." });
        return;
      }
      if (request.method !== "POST") {
        response.setHeader("allow", "POST");
        this.sendJson(response, 405, { error: "Method not allowed." });
        return;
      }

      const registration = this.authenticate(request);
      const message = companionMessageSchema.parse(
        await this.readJsonBody(request),
      );
      this.acceptMessage(registration, message);
      this.sendJson(response, 202, { accepted: true });
    } catch (error) {
      if (!request.complete) {
        request.resume();
      }
      if (response.headersSent || response.destroyed) {
        return;
      }
      if (error instanceof BridgeRequestError) {
        this.sendJson(response, error.statusCode, { error: error.message });
        return;
      }
      this.sendJson(response, 400, { error: "Invalid bridge request." });
    }
  }

  private authenticate(request: IncomingMessage): ParentRegistration {
    const authorization = request.headers.authorization;
    const prefix = "Bearer ";
    if (
      typeof authorization !== "string" ||
      !authorization.startsWith(prefix)
    ) {
      throw new BridgeRequestError(401, "Invalid bridge authorization.");
    }

    const presentedToken = authorization.slice(prefix.length);
    const registration = this.registrationsByToken.get(presentedToken);
    if (
      registration === undefined ||
      !this.constantTimeTokenMatch(
        presentedToken,
        this.tokenByParent.get(registration.parentAgentId),
      )
    ) {
      throw new BridgeRequestError(401, "Invalid bridge authorization.");
    }
    return registration;
  }

  private constantTimeTokenMatch(
    presentedToken: string,
    currentToken: string | undefined,
  ): boolean {
    if (currentToken === undefined) {
      return false;
    }
    const presented = Buffer.from(presentedToken);
    const expected = Buffer.from(currentToken);
    return (
      presented.length === expected.length &&
      timingSafeEqual(presented, expected)
    );
  }

  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const contentType = request.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
    ) {
      throw new BridgeRequestError(415, "Expected an application/json body.");
    }

    const declaredLength = Number(request.headers["content-length"]);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BRIDGE_BODY_BYTES
    ) {
      request.resume();
      throw new BridgeRequestError(413, "Bridge request body is too large.");
    }

    const chunks: Buffer[] = [];
    let bodyLength = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bodyLength += buffer.byteLength;
      if (bodyLength > MAX_BRIDGE_BODY_BYTES) {
        request.resume();
        throw new BridgeRequestError(413, "Bridge request body is too large.");
      }
      chunks.push(buffer);
    }
    if (bodyLength === 0) {
      throw new BridgeRequestError(400, "Bridge request body is empty.");
    }
    try {
      return JSON.parse(
        Buffer.concat(chunks, bodyLength).toString("utf8"),
      ) as unknown;
    } catch {
      throw new BridgeRequestError(
        400,
        "Bridge request body is not valid JSON.",
      );
    }
  }

  private acceptMessage(
    registration: ParentRegistration,
    message: CompanionMessage,
  ): void {
    if (this.closed) {
      throw new BridgeRequestError(410, "Sub-agent broker is closed.");
    }

    if (message.type === "hello") {
      const state = this.bindSession(registration, message.piSessionId);
      state.unsupportedCode = null;
      this.touch(state, MONITORING_AVAILABILITY.CONNECTED);
      this.notify(state);
      return;
    }

    if (message.type === "unsupported") {
      const state = this.bindSession(registration, message.piSessionId);
      state.unsupportedCode = message.code;
      this.touch(state, MONITORING_AVAILABILITY.UNSUPPORTED);
      this.notify(state);
      return;
    }

    const state = this.boundSession(registration, message.piSessionId);
    if (state.unsupportedCode !== null && message.type === "update") {
      throw new BridgeRequestError(
        409,
        "The Pi companion reported an unsupported integration.",
      );
    }

    if (message.type === "heartbeat") {
      const availability =
        state.unsupportedCode !== null
          ? MONITORING_AVAILABILITY.UNSUPPORTED
          : MONITORING_AVAILABILITY.CONNECTED;
      if (this.touch(state, availability)) {
        this.notify(state);
      }
      return;
    }

    const key = this.statusIdentity(message.status);
    if (!state.agents.has(key) && state.agents.size >= MAX_AGENT_COUNT) {
      throw new BridgeRequestError(
        429,
        "The session has reached its agent limit.",
      );
    }

    this.touch(state, MONITORING_AVAILABILITY.CONNECTED);
    state.agents.set(key, message.status);
    state.cursor += 1;
    state.updates.push({ cursor: state.cursor, status: message.status });
    const maxUpdates = Math.max(
      1,
      Math.min(this.options.statusBufferLength, MAX_WATCH_UPDATE_COUNT),
    );
    if (state.updates.length > maxUpdates) {
      state.updates.splice(0, state.updates.length - maxUpdates);
    }
    this.notify(state);
  }

  private bindSession(
    registration: ParentRegistration,
    piSessionId: string,
  ): SessionState {
    if (
      registration.piSessionId !== null &&
      registration.piSessionId !== piSessionId
    ) {
      throw new BridgeRequestError(
        409,
        "A bridge token cannot change Pi sessions.",
      );
    }

    const previousCurrent = this.currentSessionByParent.get(
      registration.parentAgentId,
    );
    if (previousCurrent !== undefined && previousCurrent !== piSessionId) {
      const oldState = this.getSession(
        registration.parentAgentId,
        previousCurrent,
      );
      if (oldState !== undefined) {
        this.setAvailability(oldState, MONITORING_AVAILABILITY.STALE);
      }
    }

    let sessions = this.sessionsByParent.get(registration.parentAgentId);
    if (sessions === undefined) {
      sessions = new Map();
      this.sessionsByParent.set(registration.parentAgentId, sessions);
    }
    let state = sessions.get(piSessionId);
    if (state === undefined) {
      const now = this.options.now();
      state = {
        parentAgentId: registration.parentAgentId,
        piSessionId,
        availability: MONITORING_AVAILABILITY.UNAVAILABLE,
        unsupportedCode: null,
        lastHeartbeatAt: null,
        lastActivityMs: now.getTime(),
        cursor: 0,
        revision: 0,
        agents: new Map(),
        updates: [],
        waiters: new Set(),
        staleTimer: undefined,
        deleted: false,
      };
      sessions.set(piSessionId, state);
    }

    registration.piSessionId = piSessionId;
    this.currentSessionByParent.set(registration.parentAgentId, piSessionId);
    this.pendingSessionByParent.delete(registration.parentAgentId);
    this.pruneOldSessions(registration.parentAgentId, piSessionId);
    this.notifyParentWaiters(registration.parentAgentId);
    return state;
  }

  private boundSession(
    registration: ParentRegistration,
    piSessionId: string,
  ): SessionState {
    if (registration.piSessionId === null) {
      throw new BridgeRequestError(
        409,
        "A hello or unsupported message is required first.",
      );
    }
    if (registration.piSessionId !== piSessionId) {
      throw new BridgeRequestError(
        409,
        "Bridge message Pi session does not match its token.",
      );
    }
    const state = this.getSession(registration.parentAgentId, piSessionId);
    if (state === undefined || state.deleted) {
      throw new BridgeRequestError(
        410,
        "The Pi session is no longer registered.",
      );
    }
    return state;
  }

  private touch(state: SessionState, availability: Availability): boolean {
    const now = this.options.now();
    state.lastHeartbeatAt = now.toISOString();
    state.lastActivityMs = now.getTime();
    const changed = state.availability !== availability;
    state.availability = availability;
    if (state.staleTimer !== undefined) {
      this.options.cancelTimeout(state.staleTimer);
    }
    this.scheduleStaleCheck(state, this.options.staleTimeoutMs);
    return changed;
  }

  private scheduleStaleCheck(state: SessionState, delayMs: number): void {
    state.staleTimer = this.options.scheduleTimeout(
      () => {
        state.staleTimer = undefined;
        if (state.deleted || this.closed) {
          return;
        }
        const elapsedMs = this.options.now().getTime() - state.lastActivityMs;
        if (elapsedMs < this.options.staleTimeoutMs) {
          this.scheduleStaleCheck(
            state,
            this.options.staleTimeoutMs - elapsedMs,
          );
          return;
        }
        if (state.availability !== MONITORING_AVAILABILITY.STALE) {
          this.setAvailability(state, MONITORING_AVAILABILITY.STALE);
        }
      },
      Math.max(1, delayMs),
    );
  }

  private setAvailability(
    state: SessionState,
    availability: Availability,
  ): void {
    if (state.availability === availability) {
      return;
    }
    state.availability = availability;
    state.revision += 1;
    if (state.staleTimer !== undefined) {
      this.options.cancelTimeout(state.staleTimer);
      state.staleTimer = undefined;
    }
    this.notifyWaiters(state);
  }

  private notify(state: SessionState): void {
    state.revision += 1;
    this.notifyWaiters(state);
  }

  private notifyWaiters(state: SessionState): void {
    for (const wake of [...state.waiters]) {
      wake();
    }
  }

  private waitForChange(state: SessionState): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: TimerHandle | undefined;
      const cleanup = () => {
        if (settled) {
          return;
        }
        settled = true;
        state.waiters.delete(wake);
        if (timer !== undefined) {
          this.options.cancelTimeout(timer);
        }
        resolve();
      };
      const wake = () => cleanup();
      state.waiters.add(wake);
      timer = this.options.scheduleTimeout(
        cleanup,
        this.options.watchTimeoutMs,
      );
    });
  }

  private waitForParentSession(parentAgentId: string): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: TimerHandle | undefined;
      let waiters = this.parentWaitersByParent.get(parentAgentId);
      if (waiters === undefined) {
        waiters = new Set();
        this.parentWaitersByParent.set(parentAgentId, waiters);
      }
      const cleanup = () => {
        if (settled) {
          return;
        }
        settled = true;
        waiters?.delete(wake);
        if (waiters?.size === 0) {
          this.parentWaitersByParent.delete(parentAgentId);
        }
        if (timer !== undefined) {
          this.options.cancelTimeout(timer);
        }
        resolve();
      };
      const wake = () => cleanup();
      waiters.add(wake);
      timer = this.options.scheduleTimeout(
        cleanup,
        this.options.watchTimeoutMs,
      );
    });
  }

  private notifyParentWaiters(parentAgentId: string): void {
    for (const wake of [
      ...(this.parentWaitersByParent.get(parentAgentId) ?? []),
    ]) {
      wake();
    }
  }

  private responseAfterCursor(
    state: SessionState,
    requestedCursor: number,
    observedRevision: number,
  ): WatchSubagentsOutput | null {
    if (requestedCursor > state.cursor) {
      return this.snapshotResponse(state, true);
    }

    const firstRetainedCursor = state.updates[0]?.cursor ?? state.cursor + 1;
    if (requestedCursor < firstRetainedCursor - 1) {
      return this.snapshotResponse(state, true);
    }

    const updates = state.updates.filter(
      ({ cursor }) => cursor > requestedCursor,
    );
    if (updates.length > 0) {
      return {
        parentAgentId: state.parentAgentId,
        piSessionId: state.piSessionId,
        availability: state.availability,
        cursor: state.cursor,
        gap: false,
        snapshot: null,
        updates,
      };
    }

    if (state.revision !== observedRevision) {
      return this.snapshotResponse(state, false);
    }
    return null;
  }

  private snapshotResponse(
    state: SessionState,
    gap: boolean,
  ): WatchSubagentsOutput {
    return {
      parentAgentId: state.parentAgentId,
      piSessionId: state.piSessionId,
      availability: state.availability,
      cursor: state.cursor,
      gap,
      snapshot: {
        agents: [...state.agents.values()],
        lastHeartbeatAt: state.lastHeartbeatAt,
      },
      updates: [],
    };
  }

  private unavailable(parentAgentId: string): WatchSubagentsOutput {
    return {
      parentAgentId,
      piSessionId: null,
      availability: MONITORING_AVAILABILITY.UNAVAILABLE,
      cursor: 0,
      gap: false,
      snapshot: null,
      updates: [],
    };
  }

  private getSession(
    parentAgentId: string,
    piSessionId: string,
  ): SessionState | undefined {
    return this.sessionsByParent.get(parentAgentId)?.get(piSessionId);
  }

  private statusIdentity(status: SubagentStatus): string {
    return status.source === "workflow"
      ? JSON.stringify([
          status.piSessionId,
          status.source,
          status.runId,
          status.agentId,
        ])
      : JSON.stringify([status.piSessionId, status.source, status.agentId]);
  }

  private pruneOldSessions(parentAgentId: string, keepSessionId: string): void {
    const sessions = this.sessionsByParent.get(parentAgentId);
    if (sessions === undefined || sessions.size <= MAX_SESSIONS_PER_PARENT) {
      return;
    }
    const oldest = [...sessions.values()]
      .filter(({ piSessionId }) => piSessionId !== keepSessionId)
      .sort((left, right) => left.lastActivityMs - right.lastActivityMs);
    while (sessions.size > MAX_SESSIONS_PER_PARENT && oldest.length > 0) {
      const state = oldest.shift();
      if (state !== undefined) {
        this.deleteSessionState(state);
        sessions.delete(state.piSessionId);
      }
    }
  }

  private deleteSessionState(state: SessionState): void {
    state.deleted = true;
    if (state.staleTimer !== undefined) {
      this.options.cancelTimeout(state.staleTimer);
      state.staleTimer = undefined;
    }
    this.notifyWaiters(state);
  }

  private sendJson(
    response: ServerResponse,
    statusCode: number,
    body: Record<string, unknown>,
  ): void {
    if (response.destroyed || response.writableEnded) {
      return;
    }
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(body));
  }
}

export { MAX_BRIDGE_BODY_BYTES, STALE_TIMEOUT_MS };
