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

export type PersonalGrowthReportTaskStreamEvent = {
  stage: string;
  task_id: string;
  status?: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  status_text?: string;
  progress?: number;
  created_at?: string;
  snapshot?: API.PersonalGrowthReportTaskPayload;
};

export type GrowthWorkbenchTaskStreamEvent = {
  stage: string;
  task_id: string;
  queue_id?: string;
  task_type: API.GrowthWorkbenchTaskType;
  status: API.GrowthWorkbenchTaskStatus;
  status_text?: string;
  progress?: number;
  snapshot?: API.GrowthWorkbenchTaskPayload;
  created_at?: string;
};

export type CareerDevelopmentPlanWorkspaceExportResult = {
  blob: Blob;
  filename?: string;
};

/** Normalise a failed HTTP response into a human-readable error string. */
export async function parseErrorResponse(response: {
  status: number;
  headers: { get(key: string): string | null };
  json(): Promise<any>;
  text(): Promise<string>;
}): Promise<string> {
  let detail = `Request failed with status ${response.status}.`;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (Array.isArray(payload.detail)) {
        detail = payload.detail
          .map((e: any) => e.msg || JSON.stringify(e))
          .join('; ');
      } else if (typeof payload.detail === 'string') {
        detail = payload.detail;
      } else if (payload.detail) {
        detail = JSON.stringify(payload.detail);
      }
    } catch {
      // JSON parse failed — keep default status message
    }
  } else {
    try {
      const text = await response.text();
      if (text && !text.trimStart().startsWith('<')) {
        detail = text;
      }
    } catch {
      // text() failed — keep default status message
    }
  }
  return detail;
}

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

/** 首页 v2 GET /api/home-v2 */
export async function getHomeV2(options?: { [key: string]: any }) {
  return request<API.HomeV2Response>('/api/home-v2', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 提交用户引导资料 POST /api/user-profile/onboarding */
export async function submitOnboardingProfile(body: FormData, options?: { [key: string]: any }) {
  return request<API.HomeV2Response>('/api/user-profile/onboarding', {
    method: 'POST',
    data: body,
    requestType: 'form',
    ...(options || {}),
  });
}

/** 蜗牛学习路径：从 match report 生成学习阶段 POST /api/snail-learning-path/workspaces */
const requestWith404Fallback = async <T>(
  primaryPath: string,
  fallbackPath: string,
  config: Record<string, any>,
) => {
  try {
    return await request<T>(primaryPath, config);
  } catch (error: any) {
    const status = error?.response?.status;
    if (status !== 404 || primaryPath === fallbackPath) {
      throw error;
    }
    return request<T>(fallbackPath, config);
  }
};

export async function initializeSnailLearningPathWorkspace(
  favoriteId: number,
  options?: { [key: string]: any },
) {
  return requestWith404Fallback<API.PlanWorkspaceResponse>(
    `/api/career-development-report/snail-learning-path/workspaces/${favoriteId}`,
    `/api/snail-learning-path/workspaces/${favoriteId}`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function createSnailLearningPathReview(
  workspaceId: string,
  formData: FormData,
  options?: { [key: string]: any },
) {
  return requestWith404Fallback<API.SnailLearningPathReviewResponse>(
    `/api/career-development-report/snail-learning-path/workspaces/${workspaceId}/reviews`,
    `/api/snail-learning-path/workspaces/${workspaceId}/reviews`,
    {
      method: 'POST',
      requestType: 'form',
      data: formData,
      ...(options || {}),
    },
  );
}

export async function listSnailLearningPathReviews(
  workspaceId: string,
  params?: {
    phase_key?: API.LearningPathPhaseKey;
    review_type?: 'weekly' | 'monthly';
  },
  options?: { [key: string]: any },
) {
  return requestWith404Fallback<API.SnailLearningPathReviewListResponse>(
    `/api/career-development-report/snail-learning-path/workspaces/${workspaceId}/reviews`,
    `/api/snail-learning-path/workspaces/${workspaceId}/reviews`,
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
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
    throw new Error(await parseErrorResponse(response));
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

export async function getPersonalGrowthReportWorkspace(
  favoriteId: number,
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportResponse>(
    `/api/career-development-report/personal-growth-report/workspaces/${favoriteId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function updatePersonalGrowthReportWorkspace(
  favoriteId: number,
  body: API.PersonalGrowthReportUpdateRequest,
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportResponse>(
    `/api/career-development-report/personal-growth-report/workspaces/${favoriteId}`,
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

export async function regeneratePersonalGrowthReport(
  favoriteId: number,
  body: API.PersonalGrowthReportRegenerateRequest,
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportResponse>(
    `/api/career-development-report/personal-growth-report/workspaces/${favoriteId}/regenerate`,
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

export async function createPersonalGrowthReportTask(
  body: API.PersonalGrowthReportTaskCreateRequest,
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportTaskCreateResponse>(
    '/api/career-development-report/personal-growth-report/tasks',
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

export async function getPersonalGrowthReportTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportTaskResponse>(
    `/api/career-development-report/personal-growth-report/tasks/${taskId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function cancelPersonalGrowthReportTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportTaskCancelResponse>(
    `/api/career-development-report/personal-growth-report/tasks/${taskId}/cancel`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function* streamPersonalGrowthReportTask(
  taskId: string,
  signal: AbortSignal,
): AsyncGenerator<PersonalGrowthReportTaskStreamEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch(
    `/api/career-development-report/personal-growth-report/tasks/${taskId}/stream`,
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
    throw new Error(await parseErrorResponse(response));
  }

  if (!response.body) {
    throw new Error('Personal growth task stream response was empty.');
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
        yield JSON.parse(line) as PersonalGrowthReportTaskStreamEvent;
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) {
      yield JSON.parse(tail) as PersonalGrowthReportTaskStreamEvent;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function bootstrapPersonalGrowthReport(
  options?: { [key: string]: any },
) {
  return request<API.PersonalGrowthReportResponse>(
    '/api/career-development-report/personal-growth-report/bootstrap/regenerate',
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function getGrowthWorkbench(
  favoriteId: number,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchAggregateResponse>(
    `/api/career-development-report/personal-growth-workbench/${favoriteId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function createGrowthWorkbenchTask(
  body: API.GrowthWorkbenchTaskCreateRequest,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    '/api/career-development-report/personal-growth-workbench/tasks',
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

export async function getGrowthWorkbenchTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function skipGrowthWorkbenchTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}/skip`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function cancelGrowthWorkbenchTask(
  taskId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchTaskResponse>(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}/cancel`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function acceptGrowthWorkbenchArtifact(
  artifactId: string,
  options?: { [key: string]: any },
) {
  return request<API.GrowthWorkbenchAcceptResponse>(
    `/api/career-development-report/personal-growth-workbench/artifacts/${artifactId}/accept`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function* streamGrowthWorkbenchTask(
  taskId: string,
  signal: AbortSignal,
): AsyncGenerator<GrowthWorkbenchTaskStreamEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch(
    `/api/career-development-report/personal-growth-workbench/tasks/${taskId}/stream`,
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
    throw new Error(await parseErrorResponse(response));
  }

  if (!response.body) {
    throw new Error('Growth workbench task stream response was empty.');
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
        yield JSON.parse(line) as GrowthWorkbenchTaskStreamEvent;
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (tail) {
      yield JSON.parse(tail) as GrowthWorkbenchTaskStreamEvent;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function exportPersonalGrowthReport(
  favoriteId: number,
  body: API.PersonalGrowthReportExportRequest,
): Promise<CareerDevelopmentPlanWorkspaceExportResult> {
  const token = getAccessToken();
  const response = await fetch(
    `/api/career-development-report/personal-growth-report/workspaces/${favoriteId}/export`,
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
    throw new Error(await parseErrorResponse(response));
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch =
    disposition.match(/filename\\*=UTF-8''([^;]+)/i) || disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : undefined;
  return { blob, filename };
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
    throw new Error(await parseErrorResponse(response));
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

/** 获取用户列表 GET /api/admin/users */
export async function getAdminUsers(params?: API.AdminUserQueryParams, options?: { [key: string]: any }) {
  const token = getAccessToken();
  return request<API.AdminUserListResponse>('/api/admin/users', {
    method: 'GET',
    params,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options || {}),
  });
}

/** 获取单个用户 GET /api/admin/users/{user_id} */
export async function getAdminUser(userId: number, options?: { [key: string]: any }) {
  return request<API.AdminUserDetailResponse>(`/api/admin/users/${userId}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 新增用户 POST /api/admin/users */
export async function createAdminUser(body: API.AdminUserCreateParams, options?: { [key: string]: any }) {
  const token = getAccessToken();
  return request<{
    success?: boolean;
    data: API.AdminUserItem;
  }>('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: body,
    ...(options || {}),
  });
}

/** 修改用户 PATCH /api/admin/users/{user_id} */
export async function updateAdminUser(params: API.AdminUserUpdateParams, options?: { [key: string]: any }) {
  const token = getAccessToken();
  return request<{
    success?: boolean;
    data: API.AdminUserItem;
  }>(`/api/admin/users/${params.user_id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: {
      role: params.role,
      is_active: params.is_active,
      display_name: params.display_name,
    },
    ...(options || {}),
  });
}

/** 删除用户 DELETE /api/admin/users/{user_id} */
export async function deleteAdminUser(userId: number, options?: { [key: string]: any }) {
  const token = getAccessToken();
  return request<{ success?: boolean }>(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options || {}),
  });
}

/** 获取管理员个人信息 GET /api/admin/profile */
export async function getAdminProfile(options?: { [key: string]: any }) {
  const token = getAccessToken();
  return request<API.AdminProfileResponse>('/api/admin/profile', {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options || {}),
  });
}

/** 修改管理员个人信息 PATCH /api/admin/profile */
export async function updateAdminProfile(
  body: API.AdminProfileUpdateParams,
  options?: { [key: string]: any },
) {
  return request<{
    success?: boolean;
    data: API.AdminUserItem;
  }>('/api/admin/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 就读专业分布统计 GET /api/admin/data-dashboard/major-distribution */
export async function getMajorDistribution(options?: { [key: string]: any }) {
  return request<API.MajorDistributionResponse>('/api/admin/data-dashboard/major-distribution', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 能力评估分析统计 GET /api/admin/data-dashboard/competency-analysis */
export async function getCompetencyAnalysis(options?: { [key: string]: any }) {
  return request<API.CompetencyAnalysisResponse>('/api/admin/data-dashboard/competency-analysis', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 就业趋势洞察统计 GET /api/admin/data-dashboard/employment-trends */
export async function getEmploymentTrends(options?: { [key: string]: any }) {
  return request<API.EmploymentTrendsResponse>('/api/admin/data-dashboard/employment-trends', {
    method: 'GET',
    ...(options || {}),
  });
}
