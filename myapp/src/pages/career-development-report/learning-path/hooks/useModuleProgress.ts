import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCompletedModuleIds,
  getModuleCompletionStatus,
  getModuleResources,
  getResourceCompletionId,
  loadCompletedResources,
  saveCompletedModules,
  saveCompletedResources,
} from '../learningPathUtils';
import type {
  LearningPathPhaseKey,
  LearningResourceCard,
} from '../learningPathUtils';

export interface ModuleProgressItem {
  module_id: string;
  topic: string;
  learning_content?: string;
  resource_recommendations?: any[];
  resource_status?: string;
  resource_error_message?: string;
  status: {
    total: number;
    completed: number;
    done: boolean;
  };
}

export interface UseModuleProgressResult {
  modules: ModuleProgressItem[];
  currentModule: API.GrowthPlanLearningModule | undefined;
  selectedModuleId: string | undefined;
  setSelectedModuleId: (moduleId: string | undefined) => void;
  resourceCompletedSet: Set<string>;
  toggleResourceComplete: (input: {
    phaseKey: LearningPathPhaseKey;
    moduleId: string;
    resource: LearningResourceCard;
    resourceIndex: number;
    checked: boolean;
  }) => void;
  toggleModuleComplete: (moduleId: string, checked: boolean) => void;
  submitProgress: () => void;
}

export function useModuleProgress(
  phases: API.GrowthPlanPhase[],
  phaseKey: string,
  storageKey: string,
): UseModuleProgressResult {
  const [resourceCompletedSet, setResourceCompletedSet] = useState<Set<string>>(
    () => loadCompletedResources(storageKey),
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string>();

  useEffect(() => {
    setResourceCompletedSet(loadCompletedResources(storageKey));
  }, [storageKey]);

  const currentPhase = useMemo(
    () => phases.find((p) => p.phase_key === phaseKey),
    [phases, phaseKey],
  );

  const modules = useMemo<ModuleProgressItem[]>(() => {
    if (!currentPhase) return [];
    return currentPhase.learning_modules.map((module) => {
      const resources = getModuleResources(module, phaseKey as any, {
        allowFallback: false,
      });
      const status = getModuleCompletionStatus(
        phaseKey as any,
        module,
        resourceCompletedSet,
      );
      return { ...module, status };
    });
  }, [currentPhase, phaseKey, resourceCompletedSet]);

  const currentModule = useMemo(
    () =>
      (modules.find((m) => !m.status.done) as unknown as
        | API.GrowthPlanLearningModule
        | undefined) ??
      (modules[0] as unknown as API.GrowthPlanLearningModule),
    [modules],
  );

  useEffect(() => {
    if (!currentPhase?.learning_modules.length) {
      setSelectedModuleId(undefined);
      return;
    }

    setSelectedModuleId((previous) => {
      if (
        previous &&
        currentPhase.learning_modules.some((module) => module.module_id === previous)
      ) {
        return previous;
      }
      const firstOpen = modules.find((module) => !module.status.done);
      return firstOpen?.module_id ?? currentPhase.learning_modules[0].module_id;
    });
  }, [currentPhase, modules]);

  const persistCompletionSet = useCallback(
    (next: Set<string>) => {
      saveCompletedResources(storageKey, next);
      saveCompletedModules(storageKey, getCompletedModuleIds(phases, next));
    },
    [phases, storageKey],
  );

  const toggleResourceComplete = useCallback(
    ({
      phaseKey: targetPhaseKey,
      moduleId,
      resource,
      resourceIndex,
      checked,
    }: {
      phaseKey: LearningPathPhaseKey;
      moduleId: string;
      resource: LearningResourceCard;
      resourceIndex: number;
      checked: boolean;
    }) => {
      const resourceId = getResourceCompletionId(
        targetPhaseKey,
        moduleId,
        resource,
        resourceIndex,
      );
      setResourceCompletedSet((prev) => {
        const next = new Set(prev);
        if (checked) next.add(resourceId);
        else next.delete(resourceId);
        persistCompletionSet(next);
        return next;
      });
    },
    [persistCompletionSet],
  );

  const toggleModuleComplete = useCallback(
    (moduleId: string, checked: boolean) => {
      if (!currentPhase) return;
      const module = currentPhase.learning_modules.find(
        (item) => item.module_id === moduleId,
      );
      if (!module) return;
      const resources = getModuleResources(module, currentPhase.phase_key, {
        allowFallback: false,
      });
      if (!resources.length) return;

      setResourceCompletedSet((prev) => {
        const next = new Set(prev);
        resources.forEach((resource, index) => {
          const resourceId = getResourceCompletionId(
            currentPhase.phase_key,
            module.module_id,
            resource,
            index,
          );
          if (checked) next.add(resourceId);
          else next.delete(resourceId);
        });
        persistCompletionSet(next);
        return next;
      });
    },
    [currentPhase, persistCompletionSet],
  );

  const submitProgress = useCallback(() => {
    if (!currentModule) return;
    toggleModuleComplete(currentModule.module_id, true);
  }, [currentModule, toggleModuleComplete]);

  return {
    modules,
    currentModule,
    selectedModuleId,
    setSelectedModuleId,
    resourceCompletedSet,
    toggleResourceComplete,
    toggleModuleComplete,
    submitProgress,
  };
}
