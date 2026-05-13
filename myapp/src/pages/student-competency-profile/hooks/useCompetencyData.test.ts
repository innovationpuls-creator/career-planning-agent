import { act, renderHook, waitFor } from '@testing-library/react';
import { useCompetencyData } from './useCompetencyData';

const mockGetLatestAnalysis = jest.fn();
const mockDeleteLatestAnalysis = jest.fn();
const mockSyncResult = jest.fn();
const mockGetConversation = jest.fn();

jest.mock('@/services/ant-design-pro/api', () => ({
  getStudentCompetencyLatestAnalysis: (...args: unknown[]) =>
    mockGetLatestAnalysis(...args),
  deleteStudentCompetencyLatestAnalysis: (...args: unknown[]) =>
    mockDeleteLatestAnalysis(...args),
  syncStudentCompetencyResult: (...args: unknown[]) => mockSyncResult(...args),
  getStudentCompetencyConversation: (...args: unknown[]) =>
    mockGetConversation(...args),
}));

const profile = {
  professional_skills: ['Python', 'React'],
  professional_background: ['计算机相关专业'],
  education_requirement: ['本科'],
  teamwork: ['团队协作'],
  stress_adaptability: ['适应快节奏'],
  communication: ['暂无补充信息'],
  work_experience: ['前端项目经验'],
  documentation_awareness: ['文档整理'],
  responsibility: ['责任心强'],
  learning_ability: ['学习能力强'],
  problem_solving: ['独立解决问题'],
  other_special: ['暂无补充信息'],
};

const latestAnalysis: API.StudentCompetencyLatestAnalysisPayload = {
  available: true,
  workspace_conversation_id: 'conversation-1',
  profile,
  score: { completeness: 80, competitiveness: 74, overall: 76 },
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
};

describe('useCompetencyData', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetLatestAnalysis.mockReset();
    mockDeleteLatestAnalysis.mockReset();
    mockSyncResult.mockReset();
    mockGetConversation.mockReset();

    mockGetLatestAnalysis.mockResolvedValue({
      success: true,
      data: { ...latestAnalysis },
    });
    mockGetConversation.mockResolvedValue({
      success: true,
      data: {
        workspace_conversation_id: 'conversation-1',
        dify_conversation_id: 'dify-1',
        last_message_id: 'msg-1',
        profile,
      },
    });
    mockSyncResult.mockResolvedValue({
      success: true,
      data: {
        workspace_conversation_id: 'conversation-1',
        dify_conversation_id: 'dify-1',
        last_message_id: 'msg-1',
        profile,
        latest_analysis: latestAnalysis,
      },
    });
    mockDeleteLatestAnalysis.mockResolvedValue({ success: true, data: {} });
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useCompetencyData());
    expect(result.current.loading).toBe(true);
  });

  it('fetches latest analysis and resolves loading', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.analysis.available).toBe(true);
    expect(result.current.currentProfile.professional_skills).toEqual([
      'Python',
      'React',
    ]);
    expect(mockGetLatestAnalysis).toHaveBeenCalledTimes(1);
  });

  it('sets error when fetch fails', async () => {
    mockGetLatestAnalysis.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.analysis.available).toBe(false);
  });

  it('syncs editor profile from current profile on load', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.editorProfile.professional_skills).toEqual([
      'Python',
      'React',
    ]);
  });

  it('startEdit sets isEditing to true', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.startEdit();
    });

    expect(result.current.isEditing).toBe(true);
  });

  it('cancelEdit reverts editor profile and exits edit mode', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.startEdit();
    });
    act(() => {
      result.current.addTag('professional_skills');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(result.current.isEditing).toBe(false);
    expect(result.current.editorProfile.professional_skills).toEqual([
      'Python',
      'React',
    ]);
  });

  it('addTag adds a keyword to the editor profile', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.startEdit();
    });
    act(() => {
      result.current.updateTagInput('professional_skills', 'TypeScript');
    });
    act(() => {
      result.current.addTag('professional_skills');
    });

    expect(result.current.editorProfile.professional_skills).toContain(
      'TypeScript',
    );
    expect(result.current.tagInputs.professional_skills).toBe('');
  });

  it('removeTag removes a keyword from the editor profile', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.startEdit();
    });
    act(() => {
      result.current.removeTag('professional_skills', 'Python');
    });

    expect(result.current.editorProfile.professional_skills).not.toContain(
      'Python',
    );
    expect(result.current.editorProfile.professional_skills).toContain('React');
  });

  it('save calls syncStudentCompetencyResult and exits edit mode', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.startEdit();
    });

    await act(async () => {
      await result.current.save('conv-1', undefined);
    });

    expect(mockSyncResult).toHaveBeenCalledTimes(1);
    expect(result.current.isEditing).toBe(false);
  });

  it('reset clears analysis and calls delete API', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.reset();
    });

    expect(mockDeleteLatestAnalysis).toHaveBeenCalledTimes(1);
    expect(result.current.analysis.available).toBe(false);
  });

  it('reset clears conversation and interactionStage so UI returns to upload state', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // After load, conversation has an id and stage is 'workspace'
    expect(result.current.conversation.id).toBe('conversation-1');
    expect(result.current.interactionStage).toBe('workspace');

    await act(async () => {
      await result.current.reset();
    });

    // After reset, conversation is cleared and stage returns to 'empty'
    expect(result.current.conversation.id).toBe('');
    expect(result.current.conversation.currentProfile).toBeUndefined();
    expect(result.current.interactionStage).toBe('empty');
  });

  it('reset clears localStorage snapshot', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify localStorage has a snapshot after load
    expect(
      localStorage.getItem('feature_map_student_profile_workspace_v10'),
    ).toBeTruthy();

    await act(async () => {
      await result.current.reset();
    });

    // After reset, localStorage snapshot should be cleared
    expect(
      localStorage.getItem('feature_map_student_profile_workspace_v10'),
    ).toBeNull();
  });

  it('reset returns true to signal stream should reset', async () => {
    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let resetResult: boolean | undefined;
    await act(async () => {
      resetResult = await result.current.reset();
    });

    expect(resetResult).toBe(true);
  });

  it('handles non-Error rejection gracefully', async () => {
    mockGetLatestAnalysis.mockRejectedValueOnce('string error');

    const { result } = renderHook(() => useCompetencyData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
  });
});
