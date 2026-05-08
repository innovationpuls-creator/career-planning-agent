import { CheckOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import * as React from 'react';
import type { PrerequisiteItem } from '../hooks/usePrerequisites';

type PrerequisiteCheckProps = {
  items: PrerequisiteItem[];
};

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    display: flex;
    align-items: stretch;
    gap: ${token.marginXS}px;
    padding: 14px 24px;
    background: ${token.colorBgContainer};
    border-bottom: 1px solid ${token.colorBorder};
    transition: opacity 240ms ease, transform 240ms ease, max-height 240ms ease;

    @media (max-width: 760px) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 12px 16px;
    }
  `,
  done: css`
    opacity: 0;
    transform: translateY(-8px);
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    overflow: hidden;
    border-bottom-width: 0;
  `,
  item: css`
    display: flex;
    align-items: center;
    gap: ${token.marginXS}px;
    min-width: 0;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  marker: css`
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    border: 1px solid ${token.colorTextTertiary};
    color: ${token.colorTextTertiary};
    font-size: 11px;
  `,
  markerReady: css`
    border-color: ${token.colorPrimary};
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  label: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const PrerequisiteCheck: React.FC<PrerequisiteCheckProps> = ({ items }) => {
  const { styles, cx } = useStyles();
  const allReady = items.every((item) => !item.blocking || item.ready);

  return (
    <div
      className={cx(styles.shell, allReady ? styles.done : undefined)}
      data-testid="prerequisite-check"
      aria-hidden={allReady}
    >
      {items.map((item) => (
        <div key={item.key} className={styles.item}>
          <span className={cx(styles.marker, item.ready ? styles.markerReady : undefined)}>
            {item.ready ? <CheckOutlined /> : null}
          </span>
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default PrerequisiteCheck;
