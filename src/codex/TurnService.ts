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
  private activeTurnId: string | undefined;
  public constructor(private readonly client: RpcClient) {}
  public get activeId(): string | undefined { return this.activeTurnId; }

  public async start(threadId: string, text: string, options: TurnOptions = {}): Promise<ConversationTurn> {
    const prompt = text.trim();
    if (prompt === '') throw new Error('Prompt cannot be blank');
    if (this.activeTurnId !== undefined) throw new Error('A turn is already active');
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
    this.activeTurnId = turn.id;
    return turn;
  }

  public complete(turnId: string): void {
    if (this.activeTurnId === turnId) this.activeTurnId = undefined;
  }
}
