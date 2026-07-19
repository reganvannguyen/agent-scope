import type { CollaborationModeOption } from '../codex/CollaborationModeService';
import type { ModelOption, ModelSelection } from '../codex/ModelService';

export interface FullSelection extends ModelSelection { mode: 'default' | 'plan'; }

export class SelectionService {
  public constructor(private readonly models: ModelOption[], private readonly modes: CollaborationModeOption[]) {}

  public selectModel(current: FullSelection, modelId: string, turnActive: boolean): FullSelection {
    this.requireIdle(turnActive);
    const model = this.models.find(entry => entry.id === modelId);
    if (model === undefined) throw new Error('Unsupported model');
    const effort = model.efforts.some(entry => entry.id === current.effort) ? current.effort : model.defaultEffort;
    return { ...current, modelId, effort };
  }

  public selectEffort(current: FullSelection, effort: string, turnActive: boolean): FullSelection {
    this.requireIdle(turnActive);
    const model = this.models.find(entry => entry.id === current.modelId);
    if (model === undefined || !model.efforts.some(entry => entry.id === effort)) throw new Error('Unsupported reasoning effort');
    return { ...current, effort };
  }

  public selectMode(current: FullSelection, mode: 'default' | 'plan', turnActive: boolean): FullSelection {
    this.requireIdle(turnActive);
    if (!this.modes.some(entry => entry.mode === mode)) throw new Error('Unsupported collaboration mode');
    return { ...current, mode };
  }

  private requireIdle(turnActive: boolean): void {
    if (turnActive) throw new Error('Selection controls are locked during an active turn');
  }
}
