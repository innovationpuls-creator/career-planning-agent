import { Button, Input, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeAlpha } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { scaleIn, TRANSITION } from '../motion';
import type { CoachSkill, SelectedCoachSkill } from '../types';

const { TextArea } = Input;

const useStyles = createStyles(({ css, token }) => ({
  bar: css`
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid ${claudeAlpha(claudeColors.borderCream, 0.7)};
    background: ${claudeAlpha(claudeColors.ivory, 0.5)};
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  `,
  inputWrap: css`
    flex: 1;
    position: relative;
    min-width: 0;
  `,
  textArea: css`
    flex: 1;
  `,
  palette: css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: 10;
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;
    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};
    padding: 6px;
  `,
  skillItem: css`
    width: 100%;
    border: 0;
    background: transparent;
    border-radius: 6px;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    color: ${token.colorText};
    display: block;

    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  skillItemActive: css`
    background: ${token.colorFillSecondary};
  `,
  skillHeader: css`
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  `,
  skillName: css`
    font-weight: 600;
  `,
  skillDesc: css`
    margin-top: 4px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    line-height: 1.5;
  `,
  empty: css`
    padding: 10px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
}));

interface CoachChatInputProps {
  onSend: (text: string, selectedSkill?: SelectedCoachSkill) => Promise<void> | void;
  onStop: () => void;
  onUpload: (file: File) => Promise<unknown> | undefined;
  isBusy: boolean;
  skills?: CoachSkill[];
}

export function CoachChatInput({
  onSend,
  onStop,
  onUpload,
  isBusy,
  skills = [],
}: CoachChatInputProps) {
  const { styles } = useStyles();
  const [text, setText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  const slashQuery = useMemo(() => {
    const match = text.match(/^\/([A-Za-z0-9_]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [text]);

  const filteredSkills = useMemo(() => {
    if (slashQuery === null) return [];
    return skills
      .filter((skill) => skill.enabled)
      .filter((skill) => {
        const target = `${skill.name} ${skill.label} ${skill.description}`.toLowerCase();
        return target.includes(slashQuery);
      });
  }, [skills, slashQuery]);

  const paletteOpen = slashQuery !== null && !isBusy;

  useEffect(() => {
    if (!paletteOpen) return;
    const el = paletteRef.current?.querySelector('[aria-selected="true"]');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, paletteOpen]);

  const selectedSkillFromText = useMemo(() => {
    const match = text.match(/^\/([A-Za-z0-9_]+)(?:\s+|$)/);
    if (!match) return undefined;
    const skill = skills.find((item) => item.enabled && item.name === match[1]);
    if (!skill) return undefined;
    return {
      name: skill.name,
      source: 'slash_command' as const,
      label: skill.label,
      classification: skill.classification,
    };
  }, [skills, text]);

  const completeSkill = useCallback((skill: CoachSkill) => {
    setText(`/${skill.name} `);
    setActiveIndex(0);
  }, []);

  const handleSend = useCallback(() => {
    const selectedSkill = selectedSkillFromText;
    const trimmed = text.replace(/^\/[A-Za-z0-9_]+(?:\s+|$)/, '').trim();
    if (!trimmed || isBusy) return;
    onSend(trimmed, selectedSkill);
    setText('');
    setActiveIndex(0);
  }, [text, selectedSkillFromText, isBusy, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (paletteOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((idx) => Math.min(idx + 1, filteredSkills.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((idx) => Math.max(idx - 1, 0));
          return;
        }
        if (e.key === 'Tab') {
          const skill = filteredSkills[activeIndex];
          if (skill) {
            e.preventDefault();
            completeSkill(skill);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setText('');
          setActiveIndex(0);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [activeIndex, completeSkill, filteredSkills, handleSend, paletteOpen],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUpload(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onUpload],
  );

  const reduced = prefersReducedMotion();

  return (
    <div className={styles.bar}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={isBusy}
      />
      <Button
        icon={<UploadOutlined />}
        size="small"
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
      />
      <div className={styles.inputWrap}>
        {paletteOpen && (
          <div ref={paletteRef} className={styles.palette} role="listbox" aria-label="教练能力">
            {filteredSkills.length === 0 ? (
              <div className={styles.empty}>没有匹配的教练能力</div>
            ) : (
              filteredSkills.map((skill, index) => (
                <button
                  key={skill.name}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`${styles.skillItem} ${
                    index === activeIndex ? styles.skillItemActive : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    completeSkill(skill);
                  }}
                >
                  <div className={styles.skillHeader}>
                    <span className={styles.skillName}>/{skill.name}</span>
                    <span>
                      <Tag>{skill.label}</Tag>
                      <Tag>
                        {skill.classification === 'readonly'
                          ? '只读'
                          : skill.requiresEvidence
                            ? '需证据裁决'
                            : '会修改数据'}
                      </Tag>
                    </span>
                  </div>
                  <div className={styles.skillDesc}>{skill.description}</div>
                </button>
              ))
            )}
          </div>
        )}
        <TextArea
          className={styles.textArea}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题，或输入 / 选择教练能力..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={isBusy}
          size="small"
        />
      </div>
      <AnimatePresence mode="wait">
        {isBusy ? (
          <motion.div
            key="stop"
            initial={reduced ? undefined : 'initial'}
            animate={reduced ? undefined : 'animate'}
            exit={reduced ? undefined : 'initial'}
            variants={reduced ? undefined : scaleIn}
            transition={TRANSITION.fast}
          >
            <Button danger onClick={onStop}>
              停止
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="send"
            initial={reduced ? undefined : 'initial'}
            animate={reduced ? undefined : 'animate'}
            exit={reduced ? undefined : 'initial'}
            variants={reduced ? undefined : scaleIn}
            transition={TRANSITION.fast}
          >
            <Button
              type="primary"
              onClick={handleSend}
              disabled={!text.trim()}
            >
              发送
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
