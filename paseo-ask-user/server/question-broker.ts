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
  askToolInputSchema,
} from "../shared/ask-schema.mjs";
import type {
  AnswerAskRequestInput,
  AskAnswer,
  AskTimelineData,
} from "../shared/ask-user.ts";

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;
const LOOPBACK_HOST = "127.0.0.1";

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
  questions: AskTimelineData["questions"];
  publish: TimelinePublisher;
  resolve(answers: AskAnswer[]): void;
  reject(error: Error): void;
  timer: TimerHandle;
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

  unregisterAgent(agentId: string): void {
    const token = this.tokenByAgent.get(agentId);
    if (token === undefined) {
      return;
    }
    this.tokenByAgent.delete(agentId);
    this.agentsByToken.delete(token);
  }

  async answer({
    agentId,
    requestId,
    answers,
  }: AnswerAskRequestInput): Promise<void> {
    const pending = this.pendingById.get(requestId);
    if (pending === undefined || pending.agentId !== agentId) {
      throw new Error(`Pending question was not found: ${requestId}`);
    }
    this.validateAnswers(pending, answers);
    await pending.publish({
      requestId,
      state: TIMELINE_STATE.ANSWERED,
      questions: pending.questions,
      answers,
    });
    this.finishPending(pending, answers);
  }

  async close(): Promise<void> {
    for (const pending of this.pendingById.values()) {
      this.failPending(
        pending,
        new QuestionCanceledError("The Paseo ask-user plugin stopped."),
      );
    }
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

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      if (request.method !== "POST" || request.url !== "/ask") {
        this.sendJson(response, 404, { error: "Not found." });
        return;
      }
      const registration = this.authenticate(request);
      const toolInput = askToolInputSchema.parse(
        await this.readJsonBody(request),
      );
      const requestId = this.dependencies.createRequestId();
      const answers = await this.waitForAnswer(
        registration,
        requestId,
        toolInput.questions,
        request,
      );
      this.sendJson(response, 200, { requestId, answers });
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
    questions: AskTimelineData["questions"],
    request: IncomingMessage,
  ): Promise<AskAnswer[]> {
    const answerPromise = new Promise<AskAnswer[]>((resolve, reject) => {
      const timer = this.dependencies.scheduleTimeout(() => {
        const pending = this.pendingById.get(requestId);
        if (pending === undefined) {
          return;
        }
        void this.publishTerminalState(
          pending,
          TIMELINE_STATE.TIMED_OUT,
          "The question expired before it was answered.",
        );
        this.failPending(
          pending,
          new QuestionTimedOutError("The question timed out."),
        );
      }, this.dependencies.timeoutMs);
      this.pendingById.set(requestId, {
        agentId: registration.agentId,
        requestId,
        questions,
        publish: registration.publish,
        resolve,
        reject,
        timer,
      });
    });
    request.once("aborted", () => {
      const pending = this.pendingById.get(requestId);
      if (pending === undefined) {
        return;
      }
      void this.publishTerminalState(
        pending,
        TIMELINE_STATE.CANCELED,
        "The agent stopped waiting for an answer.",
      );
      this.failPending(
        pending,
        new QuestionCanceledError("The request was canceled."),
      );
    });
    await registration.publish({
      requestId,
      state: TIMELINE_STATE.PENDING,
      questions,
    });
    return answerPromise;
  }

  private async publishTerminalState(
    pending: PendingQuestion,
    state: typeof TIMELINE_STATE.TIMED_OUT | typeof TIMELINE_STATE.CANCELED,
    message: string,
  ): Promise<void> {
    try {
      await pending.publish({
        requestId: pending.requestId,
        state,
        questions: pending.questions,
        message,
      });
    } catch (error) {
      console.error(`Failed to publish ask-user ${state} state.`, error);
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
      pending.questions.map((question) => [question.id, question]),
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

  private finishPending(pending: PendingQuestion, answers: AskAnswer[]): void {
    this.dependencies.cancelTimeout(pending.timer);
    this.pendingById.delete(pending.requestId);
    pending.resolve(answers);
  }

  private failPending(pending: PendingQuestion, error: Error): void {
    this.dependencies.cancelTimeout(pending.timer);
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
