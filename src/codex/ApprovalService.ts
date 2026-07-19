import { isRecord, type RequestId, type ServerRequest } from './ProtocolTypes';

export type PendingKind = 'command' | 'fileChange' | 'permissions' | 'userInput';
export interface PendingServerRequest {
  id: RequestId;
  method: string;
  kind: PendingKind;
  threadId: string;
  turnId: string;
  itemId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  state: 'pending' | 'resolving';
}

export type ServerResponder = (id: RequestId, result: unknown) => void;

export class ApprovalService {
  private readonly pending = new Map<string, PendingServerRequest>();
  public constructor(private readonly respond: ServerResponder) {}

  public get requests(): PendingServerRequest[] { return [...this.pending.values()]; }

  public register(request: ServerRequest): PendingServerRequest {
    if (!isRecord(request.params)) throw new Error(`Unsupported server request payload: ${request.method}`);
    const kind = methodKind(request.method);
    if (kind === undefined) throw new Error(`Unsupported server request: ${request.method}`);
    const { threadId, turnId, itemId } = request.params;
    if (typeof threadId !== 'string' || typeof turnId !== 'string' || typeof itemId !== 'string') {
      throw new Error(`Invalid server request metadata: ${request.method}`);
    }
    const pending: PendingServerRequest = {
      id: request.id, method: request.method, kind, threadId, turnId, itemId,
      payload: request.params, createdAt: Date.now(), state: 'pending'
    };
    this.pending.set(key(request.id), pending);
    return pending;
  }

  public resolve(id: RequestId, answer: unknown): void {
    const request = this.pending.get(key(id));
    if (request === undefined) throw new Error('Unknown or expired server request');
    if (request.state !== 'pending') throw new Error('Server request is already resolving');
    const result = validateAnswer(request, answer);
    request.state = 'resolving';
    try {
      this.respond(request.id, result);
    } catch (error) {
      request.state = 'pending';
      throw error;
    }
  }

  public markResolved(id: RequestId): void { this.pending.delete(key(id)); }

  public clearTurn(threadId: string, turnId: string): void {
    for (const [id, request] of this.pending) {
      if (request.threadId === threadId && request.turnId === turnId) this.pending.delete(id);
    }
  }
}

function validateAnswer(request: PendingServerRequest, answer: unknown): unknown {
  if (!isRecord(answer)) throw new Error('Invalid server request answer');
  if (request.kind === 'command') return validateCommand(request.payload, answer);
  if (request.kind === 'fileChange') return validateFile(answer);
  if (request.kind === 'permissions') return validatePermissions(request.payload, answer);
  return validateUserInput(request.payload, answer);
}

function validateCommand(payload: Record<string, unknown>, answer: Record<string, unknown>): unknown {
  const decision = answer.decision;
  const available = Array.isArray(payload.availableDecisions) ? payload.availableDecisions : [];
  if (available.length === 0 || !available.some(item => deepEqual(item, decision))) throw new Error('Decision is not allowed by the server');
  return { decision };
}

function validateFile(answer: Record<string, unknown>): unknown {
  const allowed = ['accept', 'acceptForSession', 'decline', 'cancel'];
  if (typeof answer.decision !== 'string' || !allowed.includes(answer.decision)) throw new Error('Invalid file-change decision');
  return { decision: answer.decision };
}

function validatePermissions(payload: Record<string, unknown>, answer: Record<string, unknown>): unknown {
  if (!isRecord(answer.permissions) || (answer.scope !== 'turn' && answer.scope !== 'session')) throw new Error('Invalid permission grant');
  if (!isRecord(payload.permissions) || !isSubset(answer.permissions, payload.permissions)) throw new Error('Granted permissions exceed the request');
  const result: Record<string, unknown> = { permissions: answer.permissions, scope: answer.scope };
  if (typeof answer.strictAutoReview === 'boolean') result.strictAutoReview = answer.strictAutoReview;
  return result;
}

function validateUserInput(payload: Record<string, unknown>, answer: Record<string, unknown>): unknown {
  if (!isRecord(answer.answers) || !Array.isArray(payload.questions)) throw new Error('Invalid user-input answer');
  const result: Record<string, { answers: string[] }> = {};
  for (const question of payload.questions) {
    if (!isRecord(question) || typeof question.id !== 'string') throw new Error('Invalid user-input question');
    const supplied = answer.answers[question.id];
    if (!isRecord(supplied) || !Array.isArray(supplied.answers) || !supplied.answers.every(item => typeof item === 'string')) {
      throw new Error(`Missing answer for ${question.id}`);
    }
    const values = supplied.answers;
    if (Array.isArray(question.options) && question.isOther !== true) {
      const allowed = question.options.flatMap(option => isRecord(option) && typeof option.label === 'string' ? [option.label] : []);
      if (!values.every(value => allowed.includes(value))) throw new Error(`Unsupported answer for ${question.id}`);
    }
    result[question.id] = { answers: values };
  }
  return { answers: result };
}

function methodKind(method: string): PendingKind | undefined {
  if (method === 'item/commandExecution/requestApproval') return 'command';
  if (method === 'item/fileChange/requestApproval') return 'fileChange';
  if (method === 'item/permissions/requestApproval') return 'permissions';
  if (method === 'item/tool/requestUserInput') return 'userInput';
  return undefined;
}

function key(id: RequestId): string { return `${typeof id}:${String(id)}`; }
function deepEqual(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function isSubset(granted: unknown, requested: unknown): boolean {
  if (Array.isArray(granted)) return Array.isArray(requested) && granted.every(item => requested.some(candidate => deepEqual(item, candidate)));
  if (isRecord(granted)) return isRecord(requested) && Object.entries(granted).every(([name, value]) => name in requested && isSubset(value, requested[name]));
  return deepEqual(granted, requested);
}
