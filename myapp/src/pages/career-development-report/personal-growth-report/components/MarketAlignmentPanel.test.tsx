import { render, screen } from '@testing-library/react';
import MarketAlignmentPanel from './MarketAlignmentPanel';

describe('MarketAlignmentPanel', () => {
  it('renders target and gap diagnosis summaries', () => {
    render(
      <MarketAlignmentPanel
        targetDiagnosis={{
          recommendation: 'keep',
          summary: '当前目标可继续推进。',
        }}
        gapDiagnosis={{
          summary: '优先补齐工作经验和专业技能的岗位证据。',
          priority_dimensions: [
            { key: 'work_experience', label: '工作经验', priority: 'high' },
          ],
        }}
      />,
    );

    expect(screen.getByText('当前目标可继续推进。')).toBeTruthy();
    expect(screen.getByText('优先补齐工作经验和专业技能的岗位证据。')).toBeTruthy();
    expect(screen.getByText('工作经验')).toBeTruthy();
  });
});
