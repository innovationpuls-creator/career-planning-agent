import { BankOutlined } from '@ant-design/icons';
import { Empty } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useRef } from 'react';
import { ClaudeTag } from '@/components/ui';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

interface CompanyGalleryProps {
  cards: API.CareerDevelopmentMatchEvidenceCard[];
}

const CARD_WIDTH = 230;
const GAP = 16;
const SPEED = 30;

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    padding: 24px;
    min-height: 200px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin-bottom: 16px;
  `,
  viewport: css`overflow: hidden; position: relative; margin: 0 -8px; padding: 0 8px;`,
  fadeLeft: css`
    position: absolute; top: 0; bottom: 0; left: 0;
    width: 48px; pointer-events: none; z-index: 2;
    background: linear-gradient(to right, rgba(250,249,245,0.92), transparent);
  `,
  fadeRight: css`
    position: absolute; top: 0; bottom: 0; right: 0;
    width: 48px; pointer-events: none; z-index: 2;
    background: linear-gradient(to left, rgba(250,249,245,0.92), transparent);
  `,
  track: css`
    display: flex; gap: ${GAP}px;
    padding: 8px 4px 16px;
    will-change: transform;
  `,
  card: css`
    flex-shrink: 0; width: ${CARD_WIDTH}px;
    background: rgba(255,255,255,0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 12px; padding: 18px;
    display: flex; flex-direction: column; gap: 10px;
    transition: all 0.25s ease;
    box-shadow: 0 8px 32px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.4);
    &:hover {
      transform: translateY(-2px);
      border-color: ${claudeColors.terracotta};
      box-shadow: 0 8px 24px rgba(201,100,66,0.1);
    }
  `,
  cardHeader: css`display: flex; align-items: center; gap: 12px;`,
  companyIcon: css`
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(201,100,66,0.08); color: ${claudeColors.terracotta};
    font-size: 15px; flex-shrink: 0;
  `,
  companyName: css`
    font-family: ${claudeFonts.heading}; font-size: 15px; font-weight: 600;
    color: ${claudeColors.nearBlack}; line-height: 1.3;
  `,
  companyJob: css`font-size: 12px; color: ${claudeColors.stoneGray}; margin-top: 2px;`,
  scoreRow: css`display: flex; align-items: center; gap: 10px;`,
  miniRing: css`
    flex-shrink: 0; width: 40px; height: 40px; position: relative;
    display: flex; align-items: center; justify-content: center;
  `,
  miniRingSvg: css`transform: rotate(-90deg);`,
  miniScore: css`
    position: absolute; font-family: ${claudeFonts.heading};
    font-size: 10px; font-weight: 700; color: ${claudeColors.terracotta}; line-height: 1;
  `,
  scoreLabel: css`font-size: 12px; color: ${claudeColors.stoneGray};`,
  tagRow: css`display: flex; flex-wrap: wrap; gap: 6px;`,
  emptyWrap: css`
    display: flex; align-items: center; justify-content: center; min-height: 160px;
  `,
}));

export function CompanyGallery({ cards }: CompanyGalleryProps) {
  const { styles } = useStyles();
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || cards.length < 3) return;
    const originals = Array.from(track.children) as HTMLElement[];
    originals.forEach((c) => track.appendChild(c.cloneNode(true)));
    const setWidth = cards.length * (CARD_WIDTH + GAP);
    let offset = 0;
    let lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      offset += SPEED * dt;
      if (offset >= setWidth) offset -= setWidth;
      track.style.transform = `translateX(${-offset}px)`;
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [cards.length]);

  if (!cards.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>最匹配的工作机会</div>
        <div className={styles.emptyWrap}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配公司数据" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="company-gallery">
      <div className={styles.title}>最匹配的工作机会</div>
      <div className={styles.viewport}>
        <div className={styles.fadeLeft} />
        <div className={styles.fadeRight} />
        <div className={styles.track} ref={trackRef}>
          {cards.map((card) => {
            const score = Math.round(card.match_score);
            const circ = 2 * Math.PI * 16;
            return (
              <div key={card.profile_id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.companyIcon}><BankOutlined /></div>
                  <div>
                    <div className={styles.companyName}>{card.company_name}</div>
                    <div className={styles.companyJob}>{card.job_title}</div>
                  </div>
                </div>
                <div className={styles.scoreRow}>
                  <div className={styles.miniRing}>
                    <svg className={styles.miniRingSvg} width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#f0eee6" strokeWidth="4" />
                      <circle cx="20" cy="20" r="16" fill="none" stroke={claudeColors.terracotta}
                        strokeWidth="4" strokeDasharray={circ}
                        strokeDashoffset={circ - (circ * score) / 100} strokeLinecap="round" />
                    </svg>
                    <span className={styles.miniScore}>{score}</span>
                  </div>
                  <span className={styles.scoreLabel}>匹配度</span>
                </div>
                <div className={styles.tagRow}>
                  {card.industry && <ClaudeTag>{card.industry}</ClaudeTag>}
                  {card.professional_threshold_dimension_count > 0 && (
                    <ClaudeTag>{card.professional_threshold_dimension_count} 个核心维度</ClaudeTag>
                  )}
                  {card.group_similarities?.slice(0, 2).map((g) => (
                    <ClaudeTag key={g.group_key}>{g.label || g.group_key}</ClaudeTag>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
