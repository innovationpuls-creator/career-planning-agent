// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';
import { getAccessToken } from '@/utils/authToken';

export type StudentCompetencyChatStreamEvent =
  | {
      event: 'meta';
      workspace_conversation_id: string;
      assistant_message_id: string;
      created_at: string;
    }
  | {
      event: 'delta';
      assistant_message_id: string;
      delta: string;
      stage?: string;
      progress?: number;
      created_at: string;
    }
  | {
      event: 'done';
      assistant_message_id: string;
      data: {
        workspace_conversation_id: string;
        dify_conversation_id?: string;
        last_message_id: string;
        assistant_message: string;
        output_mode: 'profile' | 'chat';
        profile?: Record<string, string[]>;
        latest_analysis?: API.StudentCompetencyLatestAnalysisPayload;
      };
    }
  | {
      event: 'error';
      assistant_message_id: string;
      detail: string;
    };

export type CareerDevelopmentGoalPlanStreamEvent = {
  stage: string;
  task_id: string;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  status_text?: string;
  progress?: number;
  created_at?: string;
  snapshot?: API.CareerDevelopmentGoalPlanTaskPayload;
};

export type CareerDevelopmentPlanWorkspaceExportResult = {
  blob: Blob;
  filename?: string;
};

/** 获取当前的用户 GET /api/currentUser */
export async function currentUser(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    data: API.CurrentUser;
  }>('/api/currentUser', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 退出登录接口 POST /api/login/outLogin */
export async function outLogin(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/login/outLogin', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 登录接口 POST /api/login/account */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  return request<API.LoginResult>('/api/login/account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/notices */
export async function register(
  body: API.RegisterParams,
  options?: { [key: string]: any },
) {
  return request<API.RegisterResult>('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

export async function getNotices(options?: { [key: string]: any }) {
  return request<API.NoticeIconList>('/api/notices', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取规则列表 GET /api/rule */
export async function rule(
  params: {
    // query
    /** 当前的页码 */
    current?: number;
    /** 页面的容量 */
    pageSize?: number;
  },
  options?: { [key: string]: any },
) {
  return request<API.RuleList>('/api/rule', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 更新规则 PUT /api/rule */
export async function updateRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'update',
      ...(options || {}),
    },
  });
}

/** 新建规则 POST /api/rule */
export async function addRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'post',
      ...(options || {}),
    },
  });
}

/** 删除规则 DELETE /api/rule */
export async function removeRule(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/rule', {
    method: 'POST',
    data: {
      method: 'delete',
      ...(options || {}),
    },
  });
}

/** 获取岗位列表 GET /api/job-postings */
export async function getJobPostings(
  params: API.JobPostingQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.JobPostingListResponse>('/api/job-postings', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取岗位标题选项 GET /api/job-postings/job-titles */
export async function getJobTitleOptions(options?: { [key: string]: any }) {
  return request<API.JobTitleOptionsResponse>('/api/job-postings/job-titles', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取指定岗位的行业选项 GET /api/job-postings/industries */
export async function getIndustryOptionsByJobTitle(
  jobTitle: string,
  options?: { [key: string]: any },
) {
  return request<API.IndustryOptionsResponse>('/api/job-postings/industries', {
    method: 'GET',
    params: {
      job_title: jobTitle,
    },
    ...(options || {}),
  });
}

/** 获取岗位画像对比列表 GET /api/job-requirement-comparisons */
export async function getJobRequirementComparisons(
  params: API.JobRequirementComparisonQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.JobRequirementComparisonListResponse>('/api/job-requirement-comparisons', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取岗位画像对比详情 GET /api/job-requirement-comparisons/{profile_id} */
export async function getJobRequirementComparison(
  profileId: number,
  options?: { [key: string]: any },
) {
  return request<API.JobRequirementComparisonDetailResponse>(
    `/api/job-requirement-comparisons/${profileId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 获取岗位要求画像图谱 GET /api/job-requirement-profile/graph */
export async function getJobRequirementProfileGraph(options?: { [key: string]: any }) {
  return request<API.JobRequirementGraphResponse>('/api/job-requirement-profile/graph', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取垂直岗位图谱 GET /api/job-requirement-profile/vertical */
export async function getVerticalJobProfile(
  params: API.VerticalJobProfileQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.VerticalJobProfileResponse>('/api/job-requirement-profile/vertical', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取垂直岗位图谱公司详情 GET /api/job-requirement-profile/vertical/company-detail */
export async function getVerticalJobProfileCompanyDetail(
  params: API.VerticalJobProfileCompanyDetailQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.VerticalJobProfileCompanyDetailResponse>(
    '/api/job-requirement-profile/vertical/company-detail',
    {
      method: 'GET',
      params: {
        ...params,
      },
      ...(options || {}),
    },
  );
}

export async function getCareerDevelopmentMatchInit(options?: { [key: string]: any }) {
  return request<API.CareerDevelopmentMatchInitResponse>(
    '/api/career-development-report/job-exploration-match/init',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function createCareerDevelopmentMatchReport(
  body: API.CareerDevelopmentMatchReportRequest,
  options?: { [key: string]: any },
) {
  return request<API.CareerDevelopmentMatchCustomResponse>(
    '/api/career-development-report/job-exploration-match/report',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function getCareerDevelopmentFavorites(options?: { [key: string]: any }) {
  return request<API.CareerDevelopmentFavoriteListResponse>('/api/career-development-report/favorites', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function createCareerDevelopmentFavorite(
  body: API.CareerDevelopmentFavoriteCreateRequest,
  options?: { [key: string]: any },
) {
  return request<API.CareerDevelopmentFavoriteResponse>('/api/career-development-report/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

export async function deleteCareerDevelopmentFavorite(
  favoriteId: number,
  options?: { [key: string]: any },
) {
  return request<void>(`/api/career-development-report/favorites/${favoriteId}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

export async function createCareerDevelopmentGoalPlanTask(
  body: API.CareerDevelopmentGoalPlanTaskCreateRequest,
  options?: { [key: string]: any },
) {
  return request<API.CareerDevelopmentGoalPlanTaskCreateResponse>(
    '/api/career-development-report/goal-setting-path-planning/tasks',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function getCareerDevelopmentGoalPlanTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.CareerDevelopmentGoalPlanTaskResponse>(
    `/api/career-development-report/goal-setting-path-planning/tasks/${taskId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function* streamCareerDevelopmentGoalPlanTask(
  taskId: string,
  signal: AbortSignal,
): AsyncGenerator<CareerDevelopmentGoalPlanStreamEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch(
    `/api/career-development-report/goal-setting-path-planning/tasks/${taskId}/stream`,
    {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/x-ndjson',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const payload = (await response.json()) as { detail?: string };
        detail = payload.detail || detail;
      } catch {}
    } else {
      try {
        detail = (await response.text()) || detail;
      } catch {}
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error('Goal plan stream response was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex < 0) {
          break;
        }
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }
        yield JSON.parse(line) as CareerDevelopmentGoalPlanStreamEvent;
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) {
      yield JSON.parse(tail) as CareerDevelopmentGoalPlanStreamEvent;
    }
  } finally {
    reader.releaseLock();
  }
}

/** 获取换岗路径可选项 GET /api/job-transfer/options */
export async function getCareerDevelopmentPlanWorkspace(
  favoriteId: number,
  options?: { [key: string]: any },
) {
  return request<API.PlanWorkspaceResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function updateCareerDevelopmentPlanWorkspace(
  favoriteId: number,
  body: API.PlanWorkspaceUpdateRequest,
  options?: { [key: string]: any },
) {
  return request<API.PlanWorkspaceResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function polishCareerDevelopmentPlanWorkspace(
  favoriteId: number,
  body: API.PlanWorkspacePolishRequest,
  options?: { [key: string]: any },
) {
  return request<API.PlanWorkspacePolishResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}/polish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function generateCareerDevelopmentPlanLearningResources(
  favoriteId: number,
  body: API.PlanLearningResourceRequest,
  options?: { [key: string]: any },
) {
  return request<API.PlanLearningResourceResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}/learning-resources`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function submitCareerDevelopmentPlanMilestone(
  favoriteId: number,
  milestoneId: string,
  formData: FormData,
  options?: { [key: string]: any },
) {
  return request<API.PlanWorkspaceMilestoneSubmissionResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}/milestones/${milestoneId}/submit`,
    {
      method: 'POST',
      requestType: 'form',
      data: formData,
      ...(options || {}),
    },
  );
}

export async function integrityCheckCareerDevelopmentPlanWorkspace(
  favoriteId: number,
  body: API.PlanWorkspaceIntegrityCheckRequest,
  options?: { [key: string]: any },
) {
  return request<API.PlanWorkspaceIntegrityCheckResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}/integrity-check`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function createCareerDevelopmentPlanWorkspaceReview(
  favoriteId: number,
  body: API.PlanWorkspaceReviewRequest,
  options?: { [key: string]: any },
) {
  return request<API.PlanWorkspaceReviewResponse>(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}/reviews`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      ...(options || {}),
    },
  );
}

export async function exportCareerDevelopmentPlanWorkspace(
  favoriteId: number,
  body: API.PlanWorkspaceExportRequest,
): Promise<CareerDevelopmentPlanWorkspaceExportResult> {
  const token = getAccessToken();
  const response = await fetch(
    `/api/career-development-report/goal-setting-path-planning/workspaces/${favoriteId}/export`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const payload = (await response.json()) as { detail?: string };
        detail = payload.detail || detail;
      } catch {}
    } else {
      try {
        detail = (await response.text()) || detail;
      } catch {}
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch =
    disposition.match(/filename\\*=UTF-8''([^;]+)/i) || disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : undefined;
  return { blob, filename };
}

export async function getJobTransferOptions(options?: { [key: string]: any }) {
  return request<API.JobTransferOptionsResponse>('/api/job-transfer/options', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取指定职业的换岗路径 GET /api/job-transfer/{career_id} */
export async function getJobTransferSource(careerId: number, options?: { [key: string]: any }) {
  return request<API.JobTransferSourceResponse>(`/api/job-transfer/source/${careerId}`, {
    method: 'GET',
    ...(options || {}),
  });
}

export async function getJobTransferProfile(careerId: number, options?: { [key: string]: any }) {
  return request<API.JobTransferResponse>(`/api/job-transfer/${careerId}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 流式获取指定职业的换岗路径 GET /api/job-transfer/{career_id}/stream */
export async function getJobTransferProfileStream(
  careerId: number,
  options?: { [key: string]: any },
) {
  return request<Response>(`/api/job-transfer/${careerId}/stream`, {
    method: 'GET',
    getResponse: true,
    responseType: 'text',
    ...(options || {}),
  });
}

/** 创建换岗路径分析任务 POST /api/job-transfer/tasks */
export async function createJobTransferTask(
  careerId: number,
  options?: { [key: string]: any },
) {
  return request<API.JobTransferTaskCreateResponse>('/api/job-transfer/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: { career_id: careerId },
    ...(options || {}),
  });
}

/** 获取换岗路径任务快照 GET /api/job-transfer/tasks/{task_id} */
export async function getJobTransferTaskSnapshot(taskId: string, options?: { [key: string]: any }) {
  return request<API.JobTransferTaskSnapshotResponse>(`/api/job-transfer/tasks/${taskId}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 取消换岗路径任务 POST /api/job-transfer/tasks/{task_id}/cancel */
export async function cancelJobTransferTask(taskId: string, options?: { [key: string]: any }) {
  return request<API.JobTransferTaskSnapshotResponse>(`/api/job-transfer/tasks/${taskId}/cancel`, {
    method: 'POST',
    ...(options || {}),
  });
}

/** 获取学生就业能力画像状态事件 GET /api/student-competency-profile/status-events */
export async function getStudentCompetencyStatusEvents(
  params: {
    conversation_id: string;
    after_id?: number;
    limit?: number;
  },
  options?: { [key: string]: any },
) {
  return request<{
    success?: boolean;
    total: number;
    data: Array<{
      event_id: number;
      conversation_id: string;
      status_text: string;
      stage?: string;
      progress?: number;
      source: string;
      details?: Record<string, any>;
      created_at: string;
    }>;
  }>('/api/student-competency-profile/status-events', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

export async function getStudentCompetencyRuntime(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    data: {
      opening_statement: string;
      fallback_opening_statement: string;
      file_upload_enabled: boolean;
      file_size_limit_mb?: number;
      image_upload: {
        variable: string;
        allowed_file_types: string[];
        allowed_file_extensions: string[];
        allowed_file_upload_methods: string[];
        max_length?: number;
      };
      document_upload: {
        variable: string;
        allowed_file_types: string[];
        allowed_file_extensions: string[];
        allowed_file_upload_methods: string[];
        max_length?: number;
      };
      fields: Array<{
        key: string;
        title: string;
        description: string;
      }>;
    };
  }>('/api/student-competency-profile/runtime', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function getStudentCompetencyLatestAnalysis(options?: { [key: string]: any }) {
  return request<API.StudentCompetencyLatestAnalysisResponse>(
    '/api/student-competency-profile/latest-analysis',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function deleteStudentCompetencyLatestAnalysis(options?: { [key: string]: any }) {
  return request<API.StudentCompetencyLatestAnalysisResponse>(
    '/api/student-competency-profile/latest-analysis',
    {
      method: 'DELETE',
      ...(options || {}),
    },
  );
}

export async function createStudentCompetencyChat(
  body: FormData,
  options?: { [key: string]: any },
) {
  return request<{
    success?: boolean;
    data: {
      workspace_conversation_id: string;
      dify_conversation_id?: string;
      last_message_id: string;
      assistant_message: string;
      output_mode: 'profile' | 'chat';
      profile?: Record<string, string[]>;
      latest_analysis?: API.StudentCompetencyLatestAnalysisPayload;
    };
  }>('/api/student-competency-profile/chat', {
    method: 'POST',
    data: body,
    requestType: 'form',
    ...(options || {}),
  });
}

export async function* streamStudentCompetencyChat(
  body: FormData,
  signal: AbortSignal,
): AsyncGenerator<StudentCompetencyChatStreamEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch('/api/student-competency-profile/chat/stream', {
    method: 'POST',
    body,
    signal,
    headers: {
      Accept: 'application/x-ndjson',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const payload = (await response.json()) as { detail?: string };
        detail = payload.detail || detail;
      } catch {}
    } else {
      try {
        detail = (await response.text()) || detail;
      } catch {}
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error('Chat stream response was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex < 0) {
          break;
        }
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }
        yield JSON.parse(line) as StudentCompetencyChatStreamEvent;
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) {
      yield JSON.parse(tail) as StudentCompetencyChatStreamEvent;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getStudentCompetencyConversation(
  workspaceConversationId: string,
  options?: { [key: string]: any },
) {
  return request<{
    success?: boolean;
    data: {
      workspace_conversation_id: string;
      dify_conversation_id?: string;
      last_message_id: string;
      profile?: Record<string, string[]>;
      updated_at?: string;
    };
  }>(`/api/student-competency-profile/conversations/${workspaceConversationId}`, {
    method: 'GET',
    ...(options || {}),
  });
}

export async function syncStudentCompetencyResult(
  body: {
    workspace_conversation_id: string;
    dify_conversation_id?: string;
    profile: Record<string, string[]>;
  },
  options?: { [key: string]: any },
) {
  return request<{
    success?: boolean;
    data: {
      workspace_conversation_id: string;
      dify_conversation_id?: string;
      last_message_id: string;
      assistant_message: string;
      profile: Record<string, string[]>;
      latest_analysis?: API.StudentCompetencyLatestAnalysisPayload;
    };
  }>('/api/student-competency-profile/result-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}
