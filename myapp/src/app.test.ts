import { serializeRequestParams } from './utils/requestParams';

describe('serializeRequestParams', () => {
  it('should serialize arrays as repeated query parameters', () => {
    expect(
      serializeRequestParams({
        job_title: ['Java', '前端开发'],
        industry: ['互联网', '计算机软件'],
        current: 1,
        pageSize: 20,
      }),
    ).toBe(
      'job_title=Java&job_title=%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91&industry=%E4%BA%92%E8%81%94%E7%BD%91&industry=%E8%AE%A1%E7%AE%97%E6%9C%BA%E8%BD%AF%E4%BB%B6&current=1&pageSize=20',
    );
  });

  it('should skip empty values', () => {
    expect(
      serializeRequestParams({
        job_title: ['Java', '', undefined],
        keyword: '',
        current: 1,
      }),
    ).toBe('job_title=Java&current=1');
  });
});
