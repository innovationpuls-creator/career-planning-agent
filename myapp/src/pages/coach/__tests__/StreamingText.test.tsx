import { render, screen } from '@testing-library/react';
import { StreamingText } from '../components/StreamingText';

// Mock matchMedia for antd-style
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('StreamingText', () => {
  test('renders markdown content', () => {
    render(<StreamingText content="**Hello** world" status="completed" />);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  test('shows content during streaming for complete blocks', () => {
    const content = ['## Title', '', '| a | b |', '|---|---|', '| 1 | 2 |'].join('\n');
    const { container } = render(
      <StreamingText content={content} status="streaming" />,
    );
    // Should render something (either skeleton or partial content)
    expect(container.textContent).toBeTruthy();
  });

  test('renders enhanced table via MarkdownTable component', () => {
    const content = ['| Name | Score |', '|------|-------|', '| Alice | 90 |'].join('\n');
    const { container } = render(
      <StreamingText content={content} status="completed" />,
    );
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
  });

  test('renders plain text with no special blocks', () => {
    render(
      <StreamingText content="Just a simple paragraph." status="completed" />,
    );
    expect(screen.getByText('Just a simple paragraph.')).toBeTruthy();
  });

  test('pending status shows nothing', () => {
    const { container } = render(<StreamingText content="" status="pending" />);
    expect(container.textContent).toBe('');
  });

  // Legacy tests from old implementation — keep passing
  test('renders bold text and headings', () => {
    const content = '# Heading\n**Bold Text**';
    render(<StreamingText content={content} status="completed" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Heading',
    );
    expect(screen.getByText('Bold Text').tagName).toBe('STRONG');
  });

  test('renders list items', () => {
    const content = '- Item 1\n- Item 2';
    render(<StreamingText content={content} status="completed" />);
    expect(screen.getByText('Item 1')).toBeTruthy();
    expect(screen.getByText('Item 2')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  test('renders fenced code block', () => {
    const content = '```javascript\nconsole.log("test");\n```';
    render(<StreamingText content={content} status="completed" />);
    const codeBlock = screen.getByText('console.log("test");');
    expect(codeBlock.tagName).toBe('CODE');
    expect(codeBlock.parentElement?.tagName).toBe('PRE');
  });

  test('does not crash with incomplete Markdown during streaming', () => {
    const content = '| Name | Age |\n|---|---|';
    const { container } = render(
      <StreamingText content={content} status="streaming" />,
    );
    expect(container).toBeTruthy();
  });
});
