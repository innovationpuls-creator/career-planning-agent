import { useCallback, useEffect, useState } from 'react';
import {
  getIndustryOptionsByJobTitle,
  getJobTitleOptions,
  getVerticalJobProfile,
} from '@/services/ant-design-pro/api';

export type ComparisonQuery = {
  jobTitle?: string;
  industries: string[];
};

export const useComparisonData = () => {
  const [comparisonData, setComparisonData] =
    useState<API.VerticalJobProfilePayload>();
  const [jobTitles, setJobTitles] = useState<API.JobTitleOption[]>([]);
  const [industries, setIndustriesOptions] = useState<API.IndustryOption[]>([]);
  const [query, setQuery] = useState<ComparisonQuery>({ industries: [] });
  const [loading, setLoading] = useState(false);
  const [industryLoading, setIndustryLoading] = useState(false);

  useEffect(() => {
    void getJobTitleOptions({ skipErrorHandler: true }).then((response) => {
      setJobTitles(response.data || []);
    });
  }, []);

  const setJobTitle = useCallback((jobTitle?: string) => {
    setQuery({ jobTitle, industries: [] });
    setIndustriesOptions([]);
    setComparisonData(undefined);
    if (!jobTitle) return;

    setIndustryLoading(true);
    void getIndustryOptionsByJobTitle(jobTitle, { skipErrorHandler: true })
      .then((response) => {
        setIndustriesOptions(response.data || []);
      })
      .finally(() => setIndustryLoading(false));
  }, []);

  const setIndustries = useCallback((nextIndustries: string[]) => {
    setQuery((current) => ({ ...current, industries: nextIndustries }));
  }, []);

  const runQuery = useCallback(async () => {
    if (!query.jobTitle) return;
    setLoading(true);
    try {
      const response = await getVerticalJobProfile({
        job_title: query.jobTitle,
        industry: query.industries,
      });
      setComparisonData(response.data);
    } finally {
      setLoading(false);
    }
  }, [query.industries, query.jobTitle]);

  return {
    comparisonData,
    jobTitles,
    industries,
    query,
    loading,
    industryLoading,
    setJobTitle,
    setIndustries,
    runQuery,
  };
};
