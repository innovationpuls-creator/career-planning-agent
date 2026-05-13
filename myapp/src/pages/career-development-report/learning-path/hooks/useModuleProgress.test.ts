import { renderHook } from '@testing-library/react';
import React, { act } from 'react';
import { useModuleProgress } from './useModuleProgress';

const mockSaveCompletedResources = jest.fn();
const mockSaveCompletedModules = jest.fn();
const mockGetCompletedModuleIds: jest.Mock = jest.fn(() => new Set());
const mockLoadCompletedResources: jest.Mock = jest.fn(() => new Set());

jest.mock('../learningPathUtils', () => ({
  saveCompletedResources: (...args: any[]) =>
    mockSaveCompletedResources(args[0], args[1]),
  saveCompletedModules: (...args: any[]) =>
    mockSaveCompletedModules(args[0], args[1]),
  getCompletedModuleIds: (...args: any[]) =>
    mockGetCompletedModuleIds(args[0], args[1]),
  loadCompletedResources: (...args: any[]) =>
    mockLoadCompletedResources(args[0]),
  getResourceCompletionId: (_pk: any, _mid: any, resource: any, idx: number) =>
    `${_pk}::${_mid}::${idx}::${resource.url}`,
  getModuleResources: jest.fn((module: any) =>
    (module.resource_recommendations || []).map((item: any) => ({
      title: item.title || item.url,
      url: item.url,
      learnWhat: item.step_label || item.reason || '',
      whyLearn: item.why_first || '',
      doneWhen: item.expected_output || '',
      logoUrl: item.logo_url,
      logoAlt: item.logo_alt,
      logoSource: item.logo_source,
    })),
  ),
  getModuleCompletionStatus: jest.fn(
    (_pk: any, module: any, resourceCompletedSet: Set<string>) => {
      const resources = (module.resource_recommendations || []) as any[];
      const total = resources.length;
      let completed = 0;
      resources.forEach((_: any, idx: number) => {
        const id = `short_term::${module.module_id}::${idx}::${resources[idx].url}`;
        if (resourceCompletedSet.has(id)) completed++;
      });
      return { total, completed, done: total > 0 && completed === total };
    },
  ),
}));

const mockPhases = [
  {
    phase_key: 'short_term',
    phase_label: '短期',
    learning_modules: [
      {
        module_id: 'm1',
        topic: 'React Basics',
        learning_content: 'Learn components.',
        resource_recommendations: [
          {
            title: 'React Docs',
            url: 'https://react.dev/learn',
            step_label: 'Finish basics',
            why_first: 'Foundation.',
            expected_output: 'Build a component.',
          },
        ],
        resource_status: 'ready' as const,
        resource_error_message: '',
      },
      {
        module_id: 'm2',
        topic: 'TypeScript Basics',
        learning_content: 'Learn types.',
        resource_recommendations: [
          {
            title: 'TS Handbook',
            url: 'https://www.typescriptlang.org/docs/',
            step_label: 'Everyday types',
            why_first: 'Required.',
            expected_output: 'Annotate a component.',
          },
        ],
        resource_status: 'ready' as const,
        resource_error_message: '',
      },
    ],
    practice_actions: [],
  },
] as unknown as API.GrowthPlanPhase[];

describe('useModuleProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompletedModuleIds.mockReturnValue(new Set());
    mockLoadCompletedResources.mockReturnValue(new Set());
  });

  it('returns all modules from phases', () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'default-key'),
    );

    expect(result.current.modules).toHaveLength(2);
    expect(result.current.modules[0].module_id).toBe('m1');
    expect(result.current.modules[1].module_id).toBe('m2');
  });

  it('marks module as completed when all resources checked', async () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'default-key'),
    );

    expect(result.current.modules[0].status.done).toBe(false);

    await act(async () => {
      result.current.toggleResourceComplete({
        phaseKey: 'short_term',
        moduleId: 'm1',
        resource: {
          title: 'React Docs',
          url: 'https://react.dev/learn',
          learnWhat: '',
          whyLearn: '',
          doneWhen: '',
        },
        resourceIndex: 0,
        checked: true,
      });
    });

    expect(result.current.modules[0].status.done).toBe(true);
    expect(result.current.modules[0].status.completed).toBe(1);
  });

  it('toggles resource completion off', async () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'default-key'),
    );

    await act(async () => {
      result.current.toggleResourceComplete({
        phaseKey: 'short_term',
        moduleId: 'm1',
        resource: {
          title: 'React Docs',
          url: 'https://react.dev/learn',
          learnWhat: '',
          whyLearn: '',
          doneWhen: '',
        },
        resourceIndex: 0,
        checked: true,
      });
    });
    expect(result.current.modules[0].status.done).toBe(true);

    await act(async () => {
      result.current.toggleResourceComplete({
        phaseKey: 'short_term',
        moduleId: 'm1',
        resource: {
          title: 'React Docs',
          url: 'https://react.dev/learn',
          learnWhat: '',
          whyLearn: '',
          doneWhen: '',
        },
        resourceIndex: 0,
        checked: false,
      });
    });
    expect(result.current.modules[0].status.done).toBe(false);
    expect(result.current.modules[0].status.completed).toBe(0);
  });

  it('persists completion to localStorage via utils', async () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'my-key'),
    );

    await act(async () => {
      result.current.toggleResourceComplete({
        phaseKey: 'short_term',
        moduleId: 'm1',
        resource: {
          title: 'React Docs',
          url: 'https://react.dev/learn',
          learnWhat: '',
          whyLearn: '',
          doneWhen: '',
        },
        resourceIndex: 0,
        checked: true,
      });
    });

    expect(mockSaveCompletedResources).toHaveBeenCalledWith(
      'my-key',
      expect.any(Set),
    );
    expect(mockSaveCompletedModules).toHaveBeenCalledWith(
      'my-key',
      expect.any(Set),
    );
  });

  it('updates currentModule to next module when current module is marked done', async () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'default-key'),
    );

    expect(result.current.currentModule?.module_id).toBe('m1');

    await act(async () => {
      result.current.toggleResourceComplete({
        phaseKey: 'short_term',
        moduleId: 'm1',
        resource: {
          title: 'React Docs',
          url: 'https://react.dev/learn',
          learnWhat: '',
          whyLearn: '',
          doneWhen: '',
        },
        resourceIndex: 0,
        checked: true,
      });
    });

    // After marking first module done, second module becomes current
    expect(result.current.currentModule?.module_id).toBe('m2');
  });

  it('submits progress by marking all current module resources done', async () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'default-key'),
    );

    await act(async () => {
      result.current.submitProgress();
    });

    expect(result.current.modules[0].status.done).toBe(true);
    expect(result.current.modules[0].status.completed).toBe(1);
  });

  it('initializes completion state from storage', () => {
    mockLoadCompletedResources.mockReturnValue(
      new Set(['short_term::m1::0::https://react.dev/learn']),
    );

    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'stored-key'),
    );

    expect(result.current.modules[0].status.done).toBe(true);
    expect(mockLoadCompletedResources).toHaveBeenCalledWith('stored-key');
  });

  it('toggles all resources for a module', async () => {
    const { result } = renderHook(() =>
      useModuleProgress(mockPhases, 'short_term', 'default-key'),
    );

    await act(async () => {
      result.current.toggleModuleComplete('m1', true);
    });

    expect(result.current.modules[0].status.done).toBe(true);

    await act(async () => {
      result.current.toggleModuleComplete('m1', false);
    });

    expect(result.current.modules[0].status.done).toBe(false);
  });
});
