import { describe, expect, it } from 'vitest';
import { SelectionService, type FullSelection } from './SelectionService';

const models = [
  { id: 'a', displayName: 'A', description: '', isDefault: true, efforts: [{ id: 'low', description: '' }], defaultEffort: 'low', inputModalities: [], supportsPersonality: false },
  { id: 'b', displayName: 'B', description: '', isDefault: false, efforts: [{ id: 'high', description: '' }], defaultEffort: 'high', inputModalities: [], supportsPersonality: false }
];
const current: FullSelection = { modelId: 'a', effort: 'low', mode: 'default' };
const service = new SelectionService(models, [{ name: 'Default', mode: 'default' }, { name: 'Plan', mode: 'plan' }]);

describe('SelectionService', () => {
  it('updates effort when a new model does not support the old effort', () => {
    expect(service.selectModel(current, 'b', false)).toEqual({ modelId: 'b', effort: 'high', mode: 'default' });
  });
  it('rejects unsupported values', () => {
    expect(() => service.selectEffort(current, 'ultra', false)).toThrow('Unsupported');
    expect(() => service.selectMode(current, 'plan', false)).not.toThrow();
  });
  it('locks all selection controls during a turn', () => {
    expect(() => service.selectModel(current, 'b', true)).toThrow('locked');
    expect(() => service.selectEffort(current, 'low', true)).toThrow('locked');
    expect(() => service.selectMode(current, 'plan', true)).toThrow('locked');
  });
});
