import { isRecord } from './ProtocolTypes';
import type { RpcClient } from './RpcClient';
import { normalizeTurn } from './ThreadService';
import type { CollaborationModeOption } from './CollaborationModeService';
import type { ConversationTurn } from '../state/AppState';

export interface TurnOptions {
  model?: string;
  effort?: string;
  mode?: CollaborationModeOption;
}

export class TurnService {
  private readonly activeTurns = new Map<string, string>();
  private readonly stopping = new Set<string>();
  public constructor(private readonly client: RpcClient) {}
  public get activeId(): string | undefined { return this.activeTurns.size === 1 ? this.activeTurns.values().next().value : undefined; }
  public get isStopping(): boolean { return this.stopping.size > 0; }
  public activeIdFor(threadId: string): string | undefined { return this.activeTurns.get(threadId); }
  public isStoppingFor(threadId: string): boolean { return this.stopping.has(threadId); }

  public async start(threadId: string, text: string, options: TurnOptions = {}): Promise<ConversationTurn> {
    const prompt = text.trim();
    if (prompt === '') throw new Error('Prompt cannot be blank');
    if (this.activeTurns.has(threadId)) throw new Error('A turn is already active for this session');
    const params: Record<string, unknown> = {
      threadId,
      input: [{ type: 'text', text: prompt, text_elements: [] }]
    };
    if (options.model !== undefined) params.model = options.model;
    if (options.effort !== undefined) params.effort = options.effort;
    if (options.mode !== undefined) {
      params.collaborationMode = {
        mode: options.mode.mode,
        settings: {
          model: options.mode.model ?? options.model ?? null,
          reasoning_effort: options.mode.reasoningEffort ?? options.effort ?? null,
          developer_instructions: null
        }
      };
    }
    const raw = await this.client.request<unknown>('turn/start', params);
    const turn = isRecord(raw) ? normalizeTurn(raw.turn) : undefined;
    if (turn === undefined) throw new Error('Invalid turn/start response');
    this.activeTurns.set(threadId, turn.id);
    this.stopping.delete(threadId);
    return turn;
  }

  public async steer(threadId: string, text: string): Promise<string> {
    const guidance = text.trim();
    if (guidance === '') throw new Error('Guidance cannot be blank');
    const expectedTurnId = this.activeTurns.get(threadId);
    if (expectedTurnId === undefined) throw new Error('No active turn to steer');
    const raw = await this.client.request<unknown>('turn/steer', {
      threadId, expectedTurnId, input: [{ type: 'text', text: guidance, text_elements: [] }]
    });
    if (!isRecord(raw) || raw.turnId !== expectedTurnId) throw new Error('Invalid turn/steer response');
    return expectedTurnId;
  }

  public async interrupt(threadId: string): Promise<void> {
    const turnId = this.activeTurns.get(threadId);
    if (turnId === undefined) throw new Error('No active turn to interrupt');
    if (this.stopping.has(threadId)) throw new Error('Turn interruption is already in progress');
    this.stopping.add(threadId);
    try {
      await this.client.request('turn/interrupt', { threadId, turnId });
    } catch (error) {
      this.stopping.delete(threadId);
      throw error;
    }
  }

  public complete(threadId: string, turnId: string): void {
    if (this.activeTurns.get(threadId) === turnId) {
      this.activeTurns.delete(threadId);
      this.stopping.delete(threadId);
    }
  }
}
