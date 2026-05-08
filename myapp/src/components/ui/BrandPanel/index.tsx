import { claudeFonts } from "@/styles/claude-tokens";
import { RobotOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

export const BRAND_FEATURES = [
  "智能职业规划与路径推荐",
  "个性化成长报告生成",
  "岗位能力图谱与对比分析",
] as const;

const useStyles = createStyles(({ token }) => ({
  brandTitle: {
    fontFamily: claudeFonts.heading,
  },
  brandIcon: {
    color: token.colorWhite,
    fontSize: 18,
  },
}));

export function BrandPanel() {
  const { styles } = useStyles();

  return (
    <div className="auth-left">
      <div className="auth-left-top">
        <div className="auth-left-logo-area">
          <div className="auth-left-logo-icon">
            <RobotOutlined className={styles.brandIcon} />
          </div>
          <span className="auth-left-logo-text">CareerAgent</span>
        </div>

        <div
          className={`auth-left-title ${styles.brandTitle}`}
          style={{ fontFamily: claudeFonts.heading }}
        >
          大学生职业规划智能体
        </div>
        <div className="auth-left-subtitle">你的 AI 职业导师</div>

        <div className="auth-left-divider" />

        <div className="auth-left-features">
          {BRAND_FEATURES.map((f) => (
            <div key={f} className="auth-left-feature-item">
              <div className="auth-left-feature-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-left-copyright">
        © {new Date().getFullYear()} CareerAgent. 保留所有权利。
      </div>

      <div className="auth-left-deco-circle" />
    </div>
  );
}
