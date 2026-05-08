import {
  AimOutlined,
  DollarOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { ClaudeStatCard } from '@/components/ui';
import { claudeColors } from '@/styles/claude-tokens';

interface QuickStatsProps {
  progress: number;
  salary: string;
  matchedJobs: number;
}

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 26px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
}));

const stagger = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.1 },
  }),
};

export function QuickStats({ progress, salary, matchedJobs }: QuickStatsProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.row}>
      <motion.div
        custom={0}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <ClaudeStatCard
          icon={<PercentageOutlined />}
          iconColor={claudeColors.terracotta}
          title="规划进度"
          value={progress}
          unit="%"
        />
      </motion.div>

      <motion.div
        custom={1}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <ClaudeStatCard
          icon={<DollarOutlined />}
          iconColor={claudeColors.terracotta}
          title="薪资参考"
          value={salary}
        />
      </motion.div>

      <motion.div
        custom={2}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <ClaudeStatCard
          icon={<AimOutlined />}
          iconColor={claudeColors.terracotta}
          title="已匹配岗位"
          value={matchedJobs}
        />
      </motion.div>
    </div>
  );
}
