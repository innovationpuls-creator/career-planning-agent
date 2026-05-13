jest.mock('antd-style', () => {
  const actual = jest.requireActual('antd-style');
  return {
    ...actual,
    keyframes: (strings: TemplateStringsArray, ..._args: string[]) => `anim-${strings[0].length}`,
  };
});

import { render, screen } from '@testing-library/react';
import { MarkdownTable } from '../components/MarkdownTable';

describe('MarkdownTable', () => {
  test('renders table with headers and rows', () => {
    render(
      <MarkdownTable>
        <thead>
          <tr><th>Name</th><th>Score</th></tr>
        </thead>
        <tbody>
          <tr><td>Alice</td><td>90</td></tr>
          <tr><td>Bob</td><td>85</td></tr>
        </tbody>
      </MarkdownTable>,
    );
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('90')).toBeTruthy();
  });

  test('wraps in scrollable container', () => {
    const { container } = render(
      <MarkdownTable>
        <thead><tr><th>Col</th></tr></thead>
        <tbody><tr><td>Val</td></tr></tbody>
      </MarkdownTable>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.querySelector('table')).toBeTruthy();
  });
});
