import { Typography } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import type { PersonalGrowthSection, PersonalGrowthSectionKey } from '../personalGrowthReportUtils';

const { Text } = Typography;

type ReportSidebarProps = {
  sections: PersonalGrowthSection[];
  activeSectionKey: PersonalGrowthSectionKey;
  onSelect: (key: PersonalGrowthSectionKey) => void;
};

const CHINESE_NUMBERS = ['一', '二', '三', '四', '五'];

const useStyles = createStyles(({ css, token }) => ({
  sidebar: css`
    position: sticky;
    top: 96px;
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    border-radius: ${token.borderRadiusLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    overflow: hidden;

    @media (max-width: 900px) {
      position: static;
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
      padding: 12px;
      border-radius: ${token.borderRadius}px;
    }
  `,

  header: css`
    padding: 20px 16px 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    @media (max-width: 900px) {
      display: none;
    }
  `,

  headerTitle: css`
    font-family: var(--font-heading);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: ${token.colorText};
  `,

  navList: css`
    display: flex;
    flex-direction: column;
    padding: 8px 0;

    @media (max-width: 900px) {
      flex-direction: row;
      flex-wrap: wrap;
      padding: 0;
      gap: 4px;
      width: 100%;
    }
  `,

  navItem: css`
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    cursor: pointer;
    transition: all var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
    border: none;
    border-left: 3px solid transparent;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    position: relative;
    outline: none;

    &:hover {
      background: ${token.colorFillQuaternary};

      .nav-title {
        transform: translateX(2px);
      }
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: -2px;
      border-radius: ${token.borderRadius}px;
    }

    &.active {
      background: ${token.colorPrimaryBg};
      border-left-color: ${token.colorPrimary};

      .nav-index {
        color: ${token.colorPrimary};
        font-weight: 700;
      }

      .nav-title {
        color: ${token.colorText};
        font-weight: 600;
      }
    }

    @media (max-width: 900px) {
      border-left: none;
      border-radius: ${token.borderRadius}px;
      padding: 8px 12px;
      flex: 0 0 auto;
      width: auto;

      &.active {
        border-left: none;
        background: ${token.colorPrimaryBg};
      }
    }
  `,

  navIndex: css`
    font-family: var(--font-heading);
    font-size: 15px;
    font-weight: 500;
    color: ${token.colorTextTertiary};
    width: 24px;
    text-align: center;
    flex-shrink: 0;
    transition: color var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));

    .active & {
      color: ${token.colorPrimary};
    }
  `,

  navTitle: css`
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: ${token.colorTextSecondary};
    transition: all var(--motion-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1));
    line-height: 1.4;

    .active & {
      color: ${token.colorText};
      font-weight: 500;
    }

    @media (max-width: 900px) {
      font-size: 12px;
    }
  `,

  statusDot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: auto;
  `,

  statusDotDone: css`
    background: ${token.colorSuccess};
  `,

  statusDotCurrent: css`
    background: ${token.colorPrimary};
  `,

  statusDotPending: css`
    background: ${token.colorBorder};
  `,

  footer: css`
    padding: 12px 16px;
    border-top: 1px solid ${token.colorBorderSecondary};
    margin-top: auto;

    @media (max-width: 900px) {
      display: none;
    }
  `,

  footerText: css`
    font-family: var(--font-body);
    font-size: 11px;
    color: ${token.colorTextTertiary};
    line-height: 1.5;
  `,
}));

const ReportSidebar: React.FC<ReportSidebarProps> = ({
  sections,
  activeSectionKey,
  onSelect,
}) => {
  const { styles, cx } = useStyles();
  const completedCount = sections.filter((s) => s.completed).length;

  return (
    <nav className={styles.sidebar} data-testid="report-sidebar" aria-label="报告章节导航">
      <div className={styles.header}>
        <span className={styles.headerTitle}>目 录</span>
      </div>

      <div className={styles.navList}>
        {sections.map((section, index) => {
          const isActive = activeSectionKey === section.key;
          const isDone = section.completed && !isActive;

          let dotClass = styles.statusDotPending;
          if (isActive) dotClass = styles.statusDotCurrent;
          else if (isDone) dotClass = styles.statusDotDone;

          return (
            <button
              key={section.key}
              type="button"
              className={cx(styles.navItem, isActive ? 'active' : undefined)}
              onClick={() => onSelect(section.key)}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className={cx(styles.navIndex, 'nav-index')}>
                {CHINESE_NUMBERS[index]}
              </span>
              <span className={cx(styles.navTitle, 'nav-title')}>
                {section.title}
              </span>
              <span className={cx(styles.statusDot, dotClass)} />
            </button>
          );
        })}
      </div>

      <div className={styles.footer}>
        <Text className={styles.footerText}>
          已完成 {completedCount} / {sections.length} 章节
        </Text>
      </div>
    </nav>
  );
};

export default ReportSidebar;
