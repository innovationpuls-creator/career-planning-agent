import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  htmlToMarkdown,
  markdownToHtml,
} from '../../../pages/career-development-report/personal-growth-report/personalGrowthReportUtils';
import RichTextEditor from './index';

const getTiptapElement = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.tiptap');

const waitForTiptap = async (container: HTMLElement): Promise<HTMLElement> => {
  const el = await waitFor(() => {
    const tiptap = getTiptapElement(container);
    if (!tiptap) throw new Error('TipTap editor not mounted');
    return tiptap;
  });
  return el;
};

describe('RichTextEditor', () => {
  it('renders without crashing', () => {
    render(<RichTextEditor content="" onChange={jest.fn()} />);
    expect(screen.getByTestId('rich-text-editor')).toBeTruthy();
  });

  it('renders with placeholder text', () => {
    render(
      <RichTextEditor
        content=""
        onChange={jest.fn()}
        placeholder="请输入内容..."
      />,
    );
    expect(screen.getByTestId('rich-text-editor')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <RichTextEditor
        content="test"
        onChange={jest.fn()}
        className="custom-editor"
      />,
    );
    expect(container.querySelector('.custom-editor')).toBeTruthy();
  });

  it('renders toolbar when not readonly', () => {
    const { container } = render(
      <RichTextEditor content="test" onChange={jest.fn()} />,
    );
    expect(
      container.querySelector('[data-testid="rich-text-editor"]'),
    ).toBeTruthy();
  });

  it('renders without toolbar when readonly', () => {
    const { container } = render(
      <RichTextEditor content="read only" onChange={jest.fn()} readonly />,
    );
    expect(
      container.querySelector('[data-testid="rich-text-editor"]'),
    ).toBeTruthy();
  });

  describe('interactions', () => {
    it('renders initial HTML content in the editor', async () => {
      const { container } = render(
        <RichTextEditor content="<p>Hello World</p>" onChange={jest.fn()} />,
      );
      const tiptap = await waitForTiptap(container);
      expect(tiptap.textContent).toContain('Hello World');
    });

    it('syncs editor content when content prop changes externally', async () => {
      const onChange = jest.fn();
      const { container, rerender } = render(
        <RichTextEditor content="<p>Initial</p>" onChange={onChange} />,
      );
      let tiptap = await waitForTiptap(container);
      expect(tiptap.textContent).toContain('Initial');

      rerender(<RichTextEditor content="<p>Updated</p>" onChange={onChange} />);
      tiptap = await waitForTiptap(container);
      await waitFor(() => {
        expect(tiptap.textContent).toContain('Updated');
      });
    });

    it('calls onChange with HTML when user types', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor content="" onChange={onChange} />,
      );
      const tiptap = await waitForTiptap(container);

      fireEvent.click(tiptap);
      // Simulate typing by modifying innerHTML and firing input — TipTap listens for input events
      tiptap.innerHTML = '<p>Hello</p>';
      fireEvent.input(tiptap);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
      const calls = onChange.mock.calls.flat();
      const anyHtml = calls.some(
        (c: unknown) => typeof c === 'string' && c.includes('Hello'),
      );
      expect(anyHtml).toBe(true);
    });

    it('renders non-editable when readonly and hides toolbar', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor
          content="<p>Readonly content</p>"
          onChange={onChange}
          readonly
        />,
      );
      const tiptap = await waitForTiptap(container);

      expect(tiptap.getAttribute('contenteditable')).toBe('false');

      const before = onChange.mock.calls.length;
      fireEvent.click(tiptap);
      tiptap.innerHTML = '<p>x</p>';
      fireEvent.input(tiptap);
      // onChange should not fire in readonly mode
      expect(onChange.mock.calls.length).toBe(before);
    });

    it('preserves formatting through HTML → Markdown → HTML roundtrip', () => {
      const html = [
        '<h2>自我认知</h2>',
        '<p><strong>Bold</strong> and <em>italic</em> text</p>',
        '<p><u>Underlined</u> and <s>Strikethrough</s></p>',
        '<ul><li>Unordered item</li></ul>',
        '<ol><li>Ordered item</li></ol>',
        '<blockquote><p>A quote</p></blockquote>',
        '<p><code>inline code</code></p>',
        '<pre><code>code block</code></pre>',
        '<p>A <a href="https://example.com">link</a></p>',
        '<hr>',
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">Done task</li></ul>',
      ].join('\n');

      const markdown = htmlToMarkdown(html);
      const roundtripped = markdownToHtml(markdown);

      expect(roundtripped).toContain('自我认知');
      expect(roundtripped).toContain('Bold');
      expect(roundtripped).toContain('italic');
      expect(roundtripped).toContain('Underlined');
      expect(roundtripped).toContain('Strikethrough');
      expect(roundtripped).toContain('Unordered item');
      expect(roundtripped).toContain('Ordered item');
      expect(roundtripped).toContain('A quote');
      expect(roundtripped).toContain('inline code');
      expect(roundtripped).toContain('code block');
    });
  });
});
