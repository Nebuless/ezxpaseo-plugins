import { randomBytes, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  ANSWER_KIND,
  QUESTION_MODE,
  TIMELINE_STATE,
  askNativeDialogInputSchema,
  askToolInputSchema,
} from "../shared/ask-schema.mjs";
import type {
  AnswerAskRequestInput,
  AskAnswer,
  AskNativeAnswer,
  AskNativeQuestion,
  AskQuestion,
  AskTimelineData,
} from "../shared/ask-user.ts";

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;
const LOOPBACK_HOST = "127.0.0.1";
const MAX_TIMER_DELAY_MS = 2_147_483_647;

type TimelinePublisher = (timelineData: AskTimelineData) => Promise<void>;
type TimerHandle = ReturnType<typeof setTimeout>;

interface BrokerDependencies {
  createRequestId(): string;
  createToken(): string;
  scheduleTimeout(callback: () => void, delayMs: number): TimerHandle;
  cancelTimeout(handle: TimerHandle): void;
  timeoutMs: number;
}

interface AgentRegistration {
  agentId: string;
  publish: TimelinePublisher;
}

interface PendingQuestion {
  agentId: string;
  requestId: string;
  protocol: "legacy" | "omp";
  questions: AskQuestion[] | AskNativeQuestion[];
  publish: TimelinePublisher;
  initialPublication: Promise<void>;
  initialPublicationError?: Error;
  resolve(
    result: AskAnswer[] | AskNativeAnswer[] | "chat" | "cancel" | "timeout",
  ): void;
  reject(error: Error): void;
  timer?: TimerHandle;
  state: "pending" | "answering" | "finished";
}

const defaultDependencies: BrokerDependencies = {
  createRequestId: randomUUID,
  createToken: () => randomBytes(32).toString("hex"),
  scheduleTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelTimeout: (handle) => clearTimeout(handle),
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

class QuestionTimedOutError extends Error {}
class QuestionCanceledError extends Error {}

export class QuestionBroker {
  private readonly dependencies: BrokerDependencies;
  private readonly server: Server;
  private readonly agentsByToken = new Map<string, AgentRegistration>();
  private readonly tokenByAgent = new Map<string, string>();
  private readonly pendingById = new Map<string, PendingQuestion>();
  private brokerUrlPromise: Promise<string> | undefined;

  constructor(dependencies: BrokerDependencies = defaultDependencies) {
    this.dependencies = dependencies;
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  start(): void {
    if (this.brokerUrlPromise !== undefined) {
      throw new Error("Question broker is already started.");
    }
    this.brokerUrlPromise = new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, LOOPBACK_HOST, () => {
        this.server.off("error", reject);
        const address = this.server.address();
        if (address === null || typeof address === "string") {
          reject(new Error("Question broker did not receive a TCP address."));
          return;
        }
        resolve(`http://${LOOPBACK_HOST}:${(address as AddressInfo).port}`);
      });
    });
  }

  getUrl(): Promise<string> {
    if (this.brokerUrlPromise === undefined) {
      throw new Error("Question broker has not been started.");
    }
    return this.brokerUrlPromise;
  }

  issueToken(): string {
    return this.dependencies.createToken();
  }

  registerAgent(
    agentId: string,
    token: string,
    publish: TimelinePublisher,
  ): void {
    const previousToken = this.tokenByAgent.get(agentId);
    if (previousToken !== undefined) {
      this.agentsByToken.delete(previousToken);
    }
    this.tokenByAgent.set(agentId, token);
    this.agentsByToken.set(token, { agentId, publish });
  }

  async answer(input: AnswerAskRequestInput): Promise<void> {
    const { agentId, requestId } = input;
    const pending = this.pendingById.get(requestId);
    if (pending === undefined || pending.agentId !== agentId) {
      throw new Error(`Pending question was not found: ${requestId}`);
    }
    if (pending.state !== "pending") {
      throw new Error(`Pending question is already closing: ${requestId}`);
    }

    if ("answers" in input) {
      const nativeInput = "action" in input;
      if ((pending.protocol === "omp") !== nativeInput) {
        throw new Error(
          `Answer protocol does not match pending question: ${requestId}`,
        );
      }
      if (pending.protocol === "omp") {
        this.validateNativeAnswers(pending, input.answers as AskNativeAnswer[]);
        await this.publishResult(pending, "submit", input.answers);
      } else {
        this.validateAnswers(pending, input.answers as AskAnswer[]);
        await this.publishResult(pending, undefined, input.answers);
      }
      return;
    }

    if (pending.protocol === "omp") {
      await this.publishResult(pending, input.action, input.action);
      return;
    }
    if (input.action === "cancel") {
      await this.cancelPending(pending, "The question was canceled.", true);
      return;
    }
    throw new Error(
      `Action does not match pending question protocol: ${requestId}`,
    );
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.pendingById.values()].map((pending) =>
        this.cancelPending(
          pending,
          "The Paseo ask-user plugin stopped.",
          false,
        ),
      ),
    );
    this.agentsByToken.clear();
    this.tokenByAgent.clear();
    if (!this.server.listening) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(
            new Error("Failed to close the question broker.", { cause: error }),
          );
          return;
        }
        resolve();
      });
    });
  }

  unregisterAgent(agentId: string): void {
    const token = this.tokenByAgent.get(agentId);
    if (token !== undefined) {
      this.tokenByAgent.delete(agentId);
      this.agentsByToken.delete(token);
    }
    for (const pending of this.pendingById.values()) {
      if (pending.agentId === agentId) {
        void this.cancelPending(
          pending,
          "The agent was archived before the question was answered.",
          false,
        );
      }
    }
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    let protocol: "legacy" | "omp";
    try {
      if (
        request.method !== "POST" ||
        (request.url !== "/ask" && request.url !== "/dialog")
      ) {
        this.sendJson(response, 404, { error: "Not found." });
        return;
      }
      protocol = request.url === "/dialog" ? "omp" : "legacy";
      const registration = this.authenticate(request);
      const body = await this.readJsonBody(request);
      if (protocol === "legacy") {
        const toolInput = askToolInputSchema.parse(body);
        const result = await this.waitForAnswer(
          registration,
          this.dependencies.createRequestId(),
          toolInput.questions,
          protocol,
          undefined,
          request,
          response,
        );
        this.sendJson(response, 200, {
          requestId: result.requestId,
          answers: result.answers as AskAnswer[],
        });
        return;
      }
      const dialogInput = askNativeDialogInputSchema.parse(body);
      const result = await this.waitForAnswer(
        registration,
        this.dependencies.createRequestId(),
        dialogInput.questions,
        protocol,
        dialogInput.timeoutMs,
        request,
        response,
      );
      if (result.action === "timeout") {
        this.sendJson(response, 200, {
          requestId: result.requestId,
          action: "timeout",
        });
      } else if (result.action === "cancel") {
        this.sendJson(response, 200, {
          requestId: result.requestId,
          action: "cancel",
        });
      } else if (result.action === "chat") {
        this.sendJson(response, 200, {
          requestId: result.requestId,
          action: "chat",
        });
      } else {
        this.sendJson(response, 200, {
          requestId: result.requestId,
          action: "submit",
          answers: result.answers as AskNativeAnswer[],
        });
      }
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        return;
      }
      if (error instanceof QuestionTimedOutError) {
        this.sendJson(response, 504, { error: error.message });
        return;
      }
      if (error instanceof QuestionCanceledError) {
        this.sendJson(response, 499, { error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.sendJson(response, 400, { error: message });
    }
  }

  private authenticate(request: IncomingMessage): AgentRegistration {
    const authorization = request.headers.authorization;
    const prefix = "Bearer ";
    if (!authorization?.startsWith(prefix)) {
      throw new Error("Missing broker authorization.");
    }
    const registration = this.agentsByToken.get(
      authorization.slice(prefix.length),
    );
    if (registration === undefined) {
      throw new Error("Invalid broker authorization.");
    }
    return registration;
  }

  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let byteCount = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteCount += buffer.length;
      if (byteCount > MAX_BODY_BYTES) {
        throw new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes.`);
      }
      chunks.push(buffer);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      throw new Error("Request body is not valid JSON.", { cause: error });
    }
  }

  private async waitForAnswer(
    registration: AgentRegistration,
    requestId: string,
    questions: AskQuestion[] | AskNativeQuestion[],
    protocol: "legacy" | "omp",
    timeoutMs: number | undefined,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<{
    requestId: string;
    answers?: AskAnswer[] | AskNativeAnswer[];
    action?: "chat" | "cancel" | "timeout";
  }> {
    let disconnected = false;
    let pendingPublished = false;
    let completeInitialPublication!: () => void;
    const initialPublication = new Promise<void>((resolve) => {
      completeInitialPublication = resolve;
    });
    const answerPromise = new Promise<{
      requestId: string;
      answers?: AskAnswer[] | AskNativeAnswer[];
      action?: "chat" | "cancel" | "timeout";
    }>((resolve, reject) => {
      const pending: PendingQuestion = {
        agentId: registration.agentId,
        requestId,
        protocol,
        questions,
        publish: registration.publish,
        initialPublication,
        resolve: (result) => {
          if (Array.isArray(result)) {
            resolve({ requestId, answers: result });
          } else {
            resolve({ requestId, action: result });
          }
        },
        reject,
        state: "pending",
      };
      this.pendingById.set(requestId, pending);
    });
    void answerPromise.catch(() => {});
    const cancelRequest = () => {
      disconnected = true;
      if (!pendingPublished) return;
      const pending = this.pendingById.get(requestId);
      if (pending === undefined || pending.state !== "pending") {
        return;
      }
      void this.cancelPending(
        pending,
        "The agent stopped waiting for an answer.",
        false,
      );
    };
    request.once("aborted", cancelRequest);
    response.once("close", () => {
      if (!response.writableFinished) {
        cancelRequest();
      }
    });
    if (response.destroyed) cancelRequest();
    const pendingTimeline: AskTimelineData =
      protocol === "omp"
        ? {
            protocol: "omp",
            requestId,
            state: TIMELINE_STATE.PENDING,
            questions: questions as AskNativeQuestion[],
          }
        : {
            requestId,
            state: TIMELINE_STATE.PENDING,
            questions: questions as AskQuestion[],
          };
    try {
      await registration.publish(pendingTimeline);
      completeInitialPublication();
      pendingPublished = true;
      if (disconnected) cancelRequest();
      else {
        const pending = this.pendingById.get(requestId);
        if (pending !== undefined && !(protocol === "omp" && timeoutMs === 0)) {
          this.scheduleDeadline(
            pending,
            timeoutMs ?? this.dependencies.timeoutMs,
          );
        }
      }
    } catch (error) {
      const pending = this.pendingById.get(requestId);
      if (pending !== undefined) {
        const publishError =
          error instanceof Error ? error : new Error(String(error));
        pending.initialPublicationError = publishError;
        completeInitialPublication();
        this.failPending(pending, publishError);
      } else {
        completeInitialPublication();
      }
      throw error;
    }
    return answerPromise;
  }

  private async publishResult(
    pending: PendingQuestion,
    action: "submit" | "chat" | "cancel" | undefined,
    result: AskAnswer[] | AskNativeAnswer[] | "chat" | "cancel",
  ): Promise<void> {
    await pending.initialPublication;
    if (pending.initialPublicationError !== undefined) {
      throw pending.initialPublicationError;
    }
    if (pending.state !== "pending") {
      throw new Error(
        `Pending question is already closing: ${pending.requestId}`,
      );
    }
    pending.state = "answering";
    if (pending.timer !== undefined) {
      this.dependencies.cancelTimeout(pending.timer);
    }
    const canceled = action === "cancel";
    try {
      await pending.publish({
        requestId: pending.requestId,
        ...(pending.protocol === "omp" ? { protocol: "omp" as const } : {}),
        state: canceled ? TIMELINE_STATE.CANCELED : TIMELINE_STATE.ANSWERED,
        questions: pending.questions,
        ...(action === undefined ? {} : { action }),
        ...(Array.isArray(result) ? { answers: result } : {}),
      } as AskTimelineData);
      this.finishPending(pending, result);
    } catch (error) {
      this.failPending(
        pending,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private scheduleDeadline(pending: PendingQuestion, delayMs: number): void {
    const startedAt = Date.now();
    const scheduleNext = () => {
      if (pending.state !== "pending") return;
      const remaining = delayMs - (Date.now() - startedAt);
      if (remaining <= 0) {
        void this.expirePending(pending);
        return;
      }
      pending.timer = this.dependencies.scheduleTimeout(
        scheduleNext,
        Math.min(remaining, MAX_TIMER_DELAY_MS),
      );
    };
    scheduleNext();
  }

  private async expirePending(pending: PendingQuestion): Promise<void> {
    if (pending.state !== "pending") return;
    if (pending.protocol === "omp") {
      await this.finishTerminal(
        pending,
        TIMELINE_STATE.TIMED_OUT,
        "timeout",
        "The question timed out.",
      );
      return;
    }
    pending.state = "answering";
    try {
      await pending.publish({
        requestId: pending.requestId,
        state: TIMELINE_STATE.TIMED_OUT,
        questions: pending.questions,
        message: "The question expired before it was answered.",
      });
    } catch (error) {
      console.error("Failed to publish ask-user timed_out state.", error);
    }
    this.failPending(
      pending,
      new QuestionTimedOutError("The question timed out."),
    );
  }

  private async cancelPending(
    pending: PendingQuestion,
    message: string,
    fromRpc: boolean,
  ): Promise<void> {
    if (pending.protocol === "omp" && fromRpc) {
      await this.publishResult(pending, "cancel", "cancel");
      return;
    }
    await this.finishTerminal(
      pending,
      TIMELINE_STATE.CANCELED,
      "cancel",
      message,
    );
  }

  private async finishTerminal(
    pending: PendingQuestion,
    state: typeof TIMELINE_STATE.TIMED_OUT | typeof TIMELINE_STATE.CANCELED,
    action: "timeout" | "cancel",
    message: string,
  ): Promise<void> {
    await pending.initialPublication;
    if (pending.initialPublicationError !== undefined) return;
    if (pending.state !== "pending") return;
    pending.state = "answering";
    try {
      await pending.publish({
        requestId: pending.requestId,
        ...(pending.protocol === "omp" ? { protocol: "omp" as const } : {}),
        state,
        questions: pending.questions,
        ...(pending.protocol === "omp" ? { action } : {}),
        ...(pending.protocol === "legacy" ? { message } : {}),
      } as AskTimelineData);
    } catch (error) {
      console.error(`Failed to publish ask-user ${state} state.`, error);
    }
    if (pending.protocol === "omp") {
      this.finishPending(pending, action);
    } else if (state === TIMELINE_STATE.TIMED_OUT) {
      this.failPending(
        pending,
        new QuestionTimedOutError("The question timed out."),
      );
    } else {
      this.failPending(
        pending,
        new QuestionCanceledError("The request was canceled."),
      );
    }
  }

  private validateAnswers(
    pending: PendingQuestion,
    answers: AskAnswer[],
  ): void {
    if (answers.length !== pending.questions.length) {
      throw new Error("Every question requires exactly one answer.");
    }
    const questionsById = new Map(
      (pending.questions as AskQuestion[]).map((question) => [
        question.id,
        question,
      ]),
    );
    const answeredIds = new Set<string>();
    for (const answer of answers) {
      const question = questionsById.get(answer.questionId);
      if (question === undefined || answeredIds.has(answer.questionId)) {
        throw new Error(
          `Answer does not match a pending question: ${answer.questionId}`,
        );
      }
      answeredIds.add(answer.questionId);
      if (!("values" in answer) || answer.kind !== ANSWER_KIND.SELECTION) {
        continue;
      }
      if (
        question.selectionMode === QUESTION_MODE.SINGLE &&
        answer.values.length !== 1
      ) {
        throw new Error(
          `Question requires one selected value: ${answer.questionId}`,
        );
      }
      const optionValues = new Set(
        question.options.map((option) => option.value),
      );
      if (answer.values.some((value) => !optionValues.has(value))) {
        throw new Error(
          `Answer contains an unknown option: ${answer.questionId}`,
        );
      }
    }
  }

  private validateNativeAnswers(
    pending: PendingQuestion,
    answers: AskNativeAnswer[],
  ): void {
    const questions = pending.questions as AskNativeQuestion[];
    if (answers.length !== questions.length) {
      throw new Error("Every question requires exactly one answer.");
    }
    const questionsById = new Map(
      questions.map((question) => [question.id, question]),
    );
    const answeredIds = new Set<string>();
    for (const answer of answers) {
      const question = questionsById.get(answer.questionId);
      if (question === undefined || answeredIds.has(answer.questionId)) {
        throw new Error(
          `Answer does not match a pending question: ${answer.questionId}`,
        );
      }
      answeredIds.add(answer.questionId);
      if (answer.kind !== "selection") continue;
      if (
        question.selectionMode === QUESTION_MODE.SINGLE &&
        answer.values.length !== 1
      ) {
        throw new Error(
          `Question requires one selected value: ${answer.questionId}`,
        );
      }
      const optionValues = new Set(
        question.options.map((option) => option.value),
      );
      if (new Set(answer.values).size !== answer.values.length) {
        throw new Error(
          `Answer contains a duplicate option: ${answer.questionId}`,
        );
      }
      if (answer.values.some((value) => !optionValues.has(value))) {
        throw new Error(
          `Answer contains an unknown option: ${answer.questionId}`,
        );
      }
    }
  }

  private finishPending(
    pending: PendingQuestion,
    result: AskAnswer[] | AskNativeAnswer[] | "chat" | "cancel" | "timeout",
  ): void {
    if (pending.state === "finished") return;
    if (pending.timer !== undefined) {
      this.dependencies.cancelTimeout(pending.timer);
    }
    pending.state = "finished";
    this.pendingById.delete(pending.requestId);
    pending.resolve(result);
  }

  private failPending(pending: PendingQuestion, error: Error): void {
    if (pending.state === "finished") return;
    if (pending.timer !== undefined) {
      this.dependencies.cancelTimeout(pending.timer);
    }
    pending.state = "finished";
    this.pendingById.delete(pending.requestId);
    pending.reject(error);
  }

  private sendJson(
    response: ServerResponse,
    statusCode: number,
    body: unknown,
  ): void {
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  }
}
