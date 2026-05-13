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

  // ── Editorial typography structural tests ──

  test('renders italic emphasis from markdown _underscores_', () => {
    const content = 'This is _emphasized_ text.';
    render(<StreamingText content={content} status="completed" />);
    const em = screen.getByText('emphasized');
    expect(em.tagName).toBe('EM');
  });

  test('renders strong as <strong> from markdown **double-asterisks**', () => {
    const content = '**标签：** 这是标签内容';
    render(<StreamingText content={content} status="completed" />);
    const strong = screen.getByText('标签：');
    expect(strong.tagName).toBe('STRONG');
  });

  test('renders blockquote with editorial pullquote markup', () => {
    const content = '> This is a pullquote';
    render(<StreamingText content={content} status="completed" />);
    const bq = screen.getByText('This is a pullquote');
    expect(bq.tagName).toBe('P');
    expect(bq.closest('blockquote')).toBeTruthy();
  });

  test('renders h1, h2, h3 with serif heading structure', () => {
    const content = '# Heading 1\n## Heading 2\n### Heading 3';
    render(<StreamingText content={content} status="completed" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Heading 1');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Heading 2');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Heading 3');
  });

  test('renders unordered and ordered lists', () => {
    const content = '- Item A\n- Item B\n\n1. Step 1\n2. Step 2';
    render(<StreamingText content={content} status="completed" />);
    expect(screen.getByText('Item A')).toBeTruthy();
    expect(screen.getByText('Step 1')).toBeTruthy();
    const lists = document.querySelectorAll('ul, ol');
    expect(lists.length).toBeGreaterThanOrEqual(2);
  });

  test('renders inline code and fenced code block distinctly', () => {
    const content = 'Use `inline code` here.\n\n```\nblock code\n```';
    render(<StreamingText content={content} status="completed" />);
    const inline = screen.getByText('inline code');
    expect(inline.tagName).toBe('CODE');
    // inline code should not be inside <pre>
    expect(inline.closest('pre')).toBeFalsy();
    // block code should be inside <pre>
    const block = screen.getByText('block code');
    expect(block.closest('pre')).toBeTruthy();
  });

  test('wraps all content in a container div', () => {
    const { container } = render(
      <StreamingText content="Hello" status="completed" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.tagName).toBe('DIV');
  });
});
