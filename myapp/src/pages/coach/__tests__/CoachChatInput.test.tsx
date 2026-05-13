jest.mock('antd-style', () => {
  const actual = jest.requireActual('antd-style');
  return {
    ...actual,
    keyframes: (strings: TemplateStringsArray, ..._args: string[]) => `anim-${strings[0].length}`,
  };
});

import { fireEvent, render, screen } from '@testing-library/react';
import { CoachChatInput } from '../components/CoachChatInput';

const skills = [
  {
    name: 'read_profile',
    label: '读取能力画像',
    description: '读取最新 12 维能力画像、差距维度和推荐关键词。',
    agent: 'ResumeCoach',
    classification: 'readonly',
    enabled: true,
    requiresEvidence: false,
  },
  {
    name: 'save_to_shortlist',
    label: '收藏岗位',
    description: '隐藏技能不应由调用方传入。',
    agent: 'CareerMatchCoach',
    classification: 'mutation_safe',
    enabled: false,
    requiresEvidence: false,
  },
];

const manySkills = Array.from({ length: 12 }, (_, i) => ({
  name: `skill_${i}`,
  label: `技能${i}`,
  description: `这是第${i}个技能的描述文本，用于测试滚动行为。`,
  agent: 'TestCoach',
  classification: 'readonly' as const,
  enabled: true,
  requiresEvidence: false,
}));

describe('CoachChatInput skill slash command', () => {
  it('shows skill suggestions when typing slash and completes with Tab', () => {
    const onSend = jest.fn();
    render(
      <CoachChatInput
        onSend={onSend}
        onStop={jest.fn()}
        onUpload={jest.fn()}
        isBusy={false}
        skills={skills}
      />,
    );

    const input = screen.getByPlaceholderText('输入你的问题，或输入 / 选择教练能力...');
    fireEvent.change(input, { target: { value: '/' } });

    expect(screen.getByText('/read_profile')).toBeTruthy();
    expect(screen.queryByText('/save_to_shortlist')).toBeNull();

    fireEvent.keyDown(input, { key: 'Tab' });
    expect((input as HTMLTextAreaElement).value).toBe('/read_profile ');
  });

  it('renders scrollable palette when many skills match slash query', () => {
    render(
      <CoachChatInput
        onSend={jest.fn()}
        onStop={jest.fn()}
        onUpload={jest.fn()}
        isBusy={false}
        skills={manySkills}
      />,
    );

    const input = screen.getByPlaceholderText('输入你的问题，或输入 / 选择教练能力...');
    fireEvent.change(input, { target: { value: '/' } });

    const palette = screen.getByRole('listbox', { name: '教练能力' });
    expect(palette).toBeTruthy();

    // All 12 skills should be in the DOM (palette must contain them,
    // even if visual clipping requires scrolling to see them)
    manySkills.forEach((skill) => {
      expect(screen.getByText(`/${skill.name}`)).toBeTruthy();
    });

    // Keyboard navigation works through all items
    for (let i = 0; i < manySkills.length - 1; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    // Last item should now be active
    const lastOption = screen.getByRole('option', { selected: true });
    expect(lastOption.textContent).toContain(`/skill_${manySkills.length - 1}`);

    // ArrowUp back to first
    for (let i = 0; i < manySkills.length - 1; i++) {
      fireEvent.keyDown(input, { key: 'ArrowUp' });
    }
    const firstOption = screen.getByRole('option', { selected: true });
    expect(firstOption.textContent).toContain('/skill_0');
  });

  it('sends selectedSkill and strips slash command from message text', () => {
    const onSend = jest.fn();
    render(
      <CoachChatInput
        onSend={onSend}
        onStop={jest.fn()}
        onUpload={jest.fn()}
        isBusy={false}
        skills={skills}
      />,
    );

    const input = screen.getByPlaceholderText('输入你的问题，或输入 / 选择教练能力...');
    fireEvent.change(input, {
      target: { value: '/read_profile 我现在短板是什么' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('我现在短板是什么', {
      name: 'read_profile',
      source: 'slash_command',
      label: '读取能力画像',
      classification: 'readonly',
    });
  });
});
