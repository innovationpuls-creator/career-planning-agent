import { Select } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { claudeFonts } from '@/styles/claude-tokens';
import type {
  PersonalGrowthSection,
  PersonalGrowthSectionKey,
} from '../personalGrowthReportUtils';

type ChapterNavProps = {
  sections: PersonalGrowthSection[];
  activeSectionKey: PersonalGrowthSectionKey;
  editedSectionKeys: PersonalGrowthSectionKey[];
  onSelect: (key: PersonalGrowthSectionKey) => void;
};

const useStyles = createStyles(({ css, token }) => ({
  desktopNav: css`
    position: sticky;
    top: 96px;
    width: 224px;
    flex: 0 0 224px;
    overflow: hidden;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;

    @media (max-width: 900px) {
      display: none;
    }
  `,
  mobileNav: css`
    display: none;
    width: 100%;

    @media (max-width: 900px) {
      display: block;
    }
  `,
  header: css`
    padding: 18px 16px 12px;
    border-bottom: 1px solid ${token.colorBorder};
  `,
  title: css`
    margin: 0;
    font-family: ${claudeFonts.heading};
    font-size: ${token.fontSizeLG}px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  list: css`
    display: grid;
    padding: 8px 0;
  `,
  item: css`
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 8px;
    align-items: center;
    gap: ${token.marginXS}px;
    width: 100%;
    padding: 12px 14px;
    border: 0;
    border-left: 3px solid transparent;
    background: transparent;
    color: ${token.colorTextSecondary};
    text-align: left;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;

    &:hover {
      background: ${token.colorFillQuaternary};
      color: ${token.colorText};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: -2px;
    }

    &.active {
      border-left-color: ${token.colorPrimary};
      color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
    }
  `,
  index: css`
    font-family: ${claudeFonts.heading};
    font-size: ${token.fontSizeLG}px;
    line-height: 1;
  `,
  label: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ${claudeFonts.heading};
    font-size: ${token.fontSize}px;
    font-weight: 500;
  `,
  editedDot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${token.colorPrimary};
  `,
  footer: css`
    padding: 12px 16px;
    border-top: 1px solid ${token.colorBorder};
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
}));

const numberLabels = ['一', '二', '三', '四', '五'];

const ChapterNav: React.FC<ChapterNavProps> = ({
  sections,
  activeSectionKey,
  editedSectionKeys,
  onSelect,
}) => {
  const { styles, cx } = useStyles();
  const editedSet = new Set(editedSectionKeys);
  const completedCount = sections.filter((section) => section.completed).length;

  return (
    <>
      <nav
        className={styles.desktopNav}
        data-testid="chapter-nav"
        aria-label="报告章节导航"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>章节目录</h2>
        </div>
        <div className={styles.list}>
          {sections.map((section, index) => {
            const active = activeSectionKey === section.key;
            return (
              <button
                key={section.key}
                type="button"
                className={cx(styles.item, active ? 'active' : undefined)}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(section.key)}
              >
                <span className={styles.index}>{numberLabels[index]}</span>
                <span className={styles.label}>{section.title}</span>
                {editedSet.has(section.key) ? (
                  <span className={styles.editedDot} title="已编辑" />
                ) : (
                  <span />
                )}
              </button>
            );
          })}
        </div>
        <div className={styles.footer}>
          已完成 {completedCount} / {sections.length} 章节
        </div>
      </nav>
      <div className={styles.mobileNav}>
        <Select
          aria-label="选择报告章节"
          data-testid="chapter-nav-select"
          value={activeSectionKey}
          options={sections.map((section) => ({
            value: section.key,
            label: section.title,
          }))}
          onChange={(key) => onSelect(key)}
          style={{ width: '100%' }}
        />
      </div>
    </>
  );
};

export default ChapterNav;
