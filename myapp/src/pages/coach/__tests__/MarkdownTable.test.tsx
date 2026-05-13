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

  test('renders tbody td elements for data cells', () => {
    render(
      <MarkdownTable>
        <thead><tr><th>Header</th></tr></thead>
        <tbody><tr><td>Data</td></tr></tbody>
      </MarkdownTable>,
    );
    const th = screen.getByText('Header');
    expect(th.tagName).toBe('TH');
    const td = screen.getByText('Data');
    expect(td.tagName).toBe('TD');
  });

  test('renders multi-row tables correctly', () => {
    render(
      <MarkdownTable>
        <thead>
          <tr><th>A</th><th>B</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>2</td></tr>
          <tr><td>3</td><td>4</td></tr>
        </tbody>
      </MarkdownTable>,
    );
    const rows = document.querySelectorAll('tr');
    // thead tr + tbody tr × 2
    expect(rows.length).toBe(3);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });
});
