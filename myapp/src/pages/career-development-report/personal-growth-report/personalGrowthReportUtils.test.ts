import {
  htmlToMarkdown,
  markdownToHtml,
  parsePersonalGrowthMarkdown,
  buildMarkdownFromSections,
  createPersonalGrowthReportTemplate,
  normalizePersonalGrowthSections,
} from './personalGrowthReportUtils';

// ── Sample TipTap HTML fragments for each format ──

const tipTapBold = '<p>普通文本 <strong>加粗文本</strong> 普通文本</p>';
const tipTapItalic = '<p>普通文本 <em>斜体文本</em> 普通文本</p>';
const tipTapUnderline = '<p>普通文本 <u>下划线文本</u> 普通文本</p>';
const tipTapStrikethrough = '<p>普通文本 <s>删除线文本</s> 普通文本</p>';
const tipTapInlineCode = '<p>变量 <code>const x = 1</code> 示例</p>';
const tipTapLink = '<p>请查看 <a href="https://example.com">这个链接</a> 了解更多</p>';
const tipTapHeading1 = '<h1>一级标题</h1>';
const tipTapHeading2 = '<h2>二级标题</h2>';
const tipTapHeading3 = '<h3>三级标题</h3>';
const tipTapUnorderedList = '<ul><li><p>第一项</p></li><li><p>第二项</p></li><li><p>第三项</p></li></ul>';
const tipTapOrderedList = '<ol><li><p>步骤一</p></li><li><p>步骤二</p></li><li><p>步骤三</p></li></ol>';
const tipTapTaskList =
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">已完成任务</li><li data-type="taskItem" data-checked="false">待办任务</li></ul>';
const tipTapBlockquote = '<blockquote><p>这是一段引用文字</p></blockquote>';
const tipTapCodeBlock = '<pre><code>function hello() {\n  return "world";\n}</code></pre>';
const tipTapHorizontalRule = '<p>上面内容</p><hr><p>下面内容</p>';
const tipTapTable =
  '<table><thead><tr><th>姓名</th><th>年龄</th><th>城市</th></tr></thead><tbody><tr><td>张三</td><td>25</td><td>北京</td></tr><tr><td>李四</td><td>30</td><td>上海</td></tr></tbody></table>';
const tipTapNestedFormat =
  '<p><strong>粗体</strong>和<em>斜体</em>以及<u>下划线</u>混合<s>删除线</s>文本</p>';

// ── HTML to Markdown ──

describe('htmlToMarkdown', () => {
  it('converts bold (<strong>) to markdown **text**', () => {
    const md = htmlToMarkdown(tipTapBold);
    expect(md).toContain('**加粗文本**');
  });

  it('converts italic (<em>) to markdown *text*', () => {
    const md = htmlToMarkdown(tipTapItalic);
    expect(md).toContain('*斜体文本*');
  });

  it('converts underline (<u>) — preserves as <u> HTML tag in markdown', () => {
    const md = htmlToMarkdown(tipTapUnderline);
    // Underline has no standard markdown; expect the HTML tag to pass through or be transformed
    expect(md).toMatch(/<u>|__/);
  });

  it('converts strikethrough (<s>) to markdown ~~text~~', () => {
    const md = htmlToMarkdown(tipTapStrikethrough);
    expect(md).toContain('~~删除线文本~~');
  });

  it('converts inline code (<code>) to markdown `code`', () => {
    const md = htmlToMarkdown(tipTapInlineCode);
    expect(md).toContain('`const x = 1`');
  });

  it('converts links (<a>) to markdown [text](url)', () => {
    const md = htmlToMarkdown(tipTapLink);
    expect(md).toContain('[这个链接](https://example.com)');
  });

  it('converts h1 to markdown # heading', () => {
    const md = htmlToMarkdown(tipTapHeading1);
    expect(md).toContain('# 一级标题');
  });

  it('converts h2 to markdown ## heading', () => {
    const md = htmlToMarkdown(tipTapHeading2);
    expect(md).toContain('## 二级标题');
  });

  it('converts h3 to markdown ### heading', () => {
    const md = htmlToMarkdown(tipTapHeading3);
    expect(md).toContain('### 三级标题');
  });

  it('converts unordered list (<ul>) to markdown - items', () => {
    const md = htmlToMarkdown(tipTapUnorderedList);
    expect(md).toContain('- 第一项');
    expect(md).toContain('- 第二项');
    expect(md).toContain('- 第三项');
  });

  it('converts ordered list (<ol>) to markdown 1. items', () => {
    const md = htmlToMarkdown(tipTapOrderedList);
    expect(md).toContain('1.  ');
    expect(md).toContain('步骤一');
    expect(md).toContain('步骤二');
    expect(md).toContain('步骤三');
  });

  it('converts task list to markdown - [x] / - [ ] items', () => {
    const md = htmlToMarkdown(tipTapTaskList);
    expect(md).toMatch(/- \[x\] 已完成任务/);
    expect(md).toMatch(/- \[ \] 待办任务/);
  });

  it('converts blockquote to markdown > text', () => {
    const md = htmlToMarkdown(tipTapBlockquote);
    expect(md).toContain('> 这是一段引用文字');
  });

  it('converts code block to fenced markdown ```', () => {
    const md = htmlToMarkdown(tipTapCodeBlock);
    expect(md).toContain('```');
    expect(md).toContain('function hello()');
  });

  it('converts horizontal rule to markdown ---', () => {
    const md = htmlToMarkdown(tipTapHorizontalRule);
    expect(md).toContain('---');
  });

  it('converts table to markdown table format', () => {
    const md = htmlToMarkdown(tipTapTable);
    // Expect table-style output with pipes or at minimum preserve the cell content
    expect(md).toContain('姓名');
    expect(md).toContain('张三');
    expect(md).toContain('北京');
    expect(md).toContain('上海');
  });

  it('preserves nested formatting (bold + italic + underline + strikethrough)', () => {
    const md = htmlToMarkdown(tipTapNestedFormat);
    expect(md).toContain('**粗体**');
    expect(md).toContain('*斜体*');
    expect(md).toContain('~~删除线~~');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('   ')).toBe('');
  });
});

// ── Markdown to HTML ──

describe('markdownToHtml', () => {
  it('converts markdown **bold** to <strong> HTML', () => {
    const html = markdownToHtml('这是 **加粗** 文本');
    expect(html).toMatch(/<strong>加粗<\/strong>/);
  });

  it('converts markdown *italic* to <em> HTML', () => {
    const html = markdownToHtml('这是 *斜体* 文本');
    expect(html).toMatch(/<em>斜体<\/em>/);
  });

  it('converts markdown ~~strikethrough~~ to <s> or <del> HTML', () => {
    const html = markdownToHtml('这是 ~~删除~~ 文本');
    expect(html).toMatch(/<del>删除<\/del>|<s>删除<\/s>/);
  });

  it('converts markdown headings to HTML headings', () => {
    const html = markdownToHtml('# 标题一\n## 标题二\n### 标题三');
    expect(html).toMatch(/<h1[^>]*>标题一<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>标题二<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>标题三<\/h3>/);
  });

  it('converts unordered lists to <ul> HTML', () => {
    const html = markdownToHtml('- 项目A\n- 项目B');
    expect(html).toMatch(/<ul>/);
    expect(html).toMatch(/<li[^>]*>项目A<\/li>/);
    expect(html).toMatch(/<li[^>]*>项目B<\/li>/);
  });

  it('converts ordered lists to <ol> HTML', () => {
    const html = markdownToHtml('1. 第一步\n2. 第二步');
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/第一步/);
    expect(html).toMatch(/第二步/);
  });

  it('converts blockquote to <blockquote> HTML', () => {
    const html = markdownToHtml('> 引用文字');
    expect(html).toMatch(/<blockquote>/);
    expect(html).toMatch(/引用文字/);
  });

  it('converts fenced code blocks to <pre><code>', () => {
    const html = markdownToHtml('```\nconst x = 1;\n```');
    expect(html).toMatch(/<pre><code[^>]*>/);
    expect(html).toMatch(/const x = 1/);
  });

  it('converts links to <a> HTML', () => {
    const html = markdownToHtml('[点击](https://example.com)');
    expect(html).toMatch(/<a href="https:\/\/example\.com"[^>]*>点击<\/a>/);
  });

  it('converts horizontal rules to <hr> HTML', () => {
    const html = markdownToHtml('上面\n\n---\n\n下面');
    expect(html).toMatch(/<hr/);
  });

  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
    expect(markdownToHtml('   ')).toBe('');
  });
});

// ── Roundtrip fidelity (HTML → MD → HTML) ──

describe('HTML → Markdown → HTML roundtrip', () => {
  it('preserves bold formatting after roundtrip', () => {
    const md = htmlToMarkdown(tipTapBold);
    const html = markdownToHtml(md);
    expect(html).toMatch(/<strong>加粗文本<\/strong>/);
  });

  it('preserves italic formatting after roundtrip', () => {
    const md = htmlToMarkdown(tipTapItalic);
    const html = markdownToHtml(md);
    expect(html).toMatch(/<em>斜体文本<\/em>/);
  });

  it('preserves strikethrough formatting after roundtrip', () => {
    const md = htmlToMarkdown(tipTapStrikethrough);
    const html = markdownToHtml(md);
    expect(html).toMatch(/<del>删除线文本<\/del>|<s>删除线文本<\/s>/);
  });

  it('preserves link after roundtrip', () => {
    const md = htmlToMarkdown(tipTapLink);
    const html = markdownToHtml(md);
    expect(html).toMatch(/这个链接/);
    expect(html).toMatch(/https:\/\/example\.com/);
  });

  it('preserves unordered list items after roundtrip', () => {
    const md = htmlToMarkdown(tipTapUnorderedList);
    const html = markdownToHtml(md);
    expect(html).toMatch(/第一项/);
    expect(html).toMatch(/第二项/);
  });

  it('preserves ordered list items after roundtrip', () => {
    const md = htmlToMarkdown(tipTapOrderedList);
    const html = markdownToHtml(md);
    expect(html).toMatch(/步骤一/);
    expect(html).toMatch(/步骤二/);
  });

  it('preserves task list items after roundtrip', () => {
    const md = htmlToMarkdown(tipTapTaskList);
    const html = markdownToHtml(md);
    expect(html).toMatch(/已完成任务/);
    expect(html).toMatch(/待办任务/);
  });

  it('preserves blockquote after roundtrip', () => {
    const md = htmlToMarkdown(tipTapBlockquote);
    const html = markdownToHtml(md);
    expect(html).toMatch(/引用文字/);
  });

  it('preserves code block content after roundtrip', () => {
    const md = htmlToMarkdown(tipTapCodeBlock);
    const html = markdownToHtml(md);
    expect(html).toMatch(/function hello/);
    expect(html).toMatch(/world/);
  });

  it('preserves table cell content after roundtrip', () => {
    const md = htmlToMarkdown(tipTapTable);
    const html = markdownToHtml(md);
    expect(html).toMatch(/张三/);
    expect(html).toMatch(/北京/);
  });
});

// ── Section parsing and template generation ──

describe('parsePersonalGrowthMarkdown', () => {
  const fullMarkdown = `# 个人职业成长报告

## 自我认知
具备基础开发能力，对前端技术有浓厚兴趣。

## 职业方向分析
适合前端工程方向，建议深耕 React 生态。

## 匹配度判断
项目证据仍需补强，缺乏生产环境经验。

## 发展建议
优先补齐项目和工程化能力。

## 行动计划
### 短期行动（0-3个月）
- 完成一个组件化项目

### 中期行动（3-9个月）
- 沉淀作品集

### 长期行动（9-24个月）
- 完成求职准备`;

  it('parses all 5 sections from complete markdown', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    expect(result.sections).toHaveLength(5);
    expect(result.missingSectionKeys).toHaveLength(0);
  });

  it('identifies self_cognition section by keyword', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    const section = result.sections.find((s) => s.key === 'self_cognition');
    expect(section?.content).toContain('具备基础开发能力');
    expect(section?.completed).toBe(true);
  });

  it('identifies career_direction_analysis section', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    const section = result.sections.find((s) => s.key === 'career_direction_analysis');
    expect(section?.content).toContain('React 生态');
    expect(section?.completed).toBe(true);
  });

  it('identifies match_assessment section', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    const section = result.sections.find((s) => s.key === 'match_assessment');
    expect(section?.content).toContain('项目证据');
    expect(section?.completed).toBe(true);
  });

  it('identifies development_suggestions section', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    const section = result.sections.find((s) => s.key === 'development_suggestions');
    expect(section?.content).toContain('工程化能力');
    expect(section?.completed).toBe(true);
  });

  it('identifies action_plan section with sub-sections', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    const section = result.sections.find((s) => s.key === 'action_plan');
    expect(section?.content).toContain('短期行动');
    expect(section?.content).toContain('组件化项目');
    expect(section?.completed).toBe(true);
  });

  it('returns missingSectionKeys for empty sections', () => {
    const incomplete = `# 个人职业成长报告

## 自我认知
具备基础能力。

## 职业方向分析
`;

    const result = parsePersonalGrowthMarkdown(incomplete);
    expect(result.missingSectionKeys).toContain('career_direction_analysis');
  });

  it('builds normalized markdown from sections', () => {
    const result = parsePersonalGrowthMarkdown(fullMarkdown);
    expect(result.normalizedMarkdown).toContain('# 个人职业成长报告');
    expect(result.normalizedMarkdown).toContain('## 自我认知');
  });
});

describe('buildMarkdownFromSections', () => {
  it('produces valid markdown with all sections', () => {
    const markdown = buildMarkdownFromSections([
      { key: 'self_cognition', title: '自我认知', content: '了解自己。', completed: true },
      { key: 'career_direction_analysis', title: '职业方向分析', content: '明确方向。', completed: true },
      { key: 'match_assessment', title: '匹配度判断', content: '评估差距。', completed: true },
      { key: 'development_suggestions', title: '发展建议', content: '规划提升。', completed: true },
      { key: 'action_plan', title: '行动计划', content: '执行方案。', completed: true },
    ]);

    expect(markdown).toContain('# 个人职业成长报告');
    expect(markdown).toContain('## 自我认知');
    expect(markdown).toContain('了解自己。');
    expect(markdown).toContain('## 职业方向分析');
    expect(markdown).toContain('明确方向。');
    expect(markdown).toContain('## 匹配度判断');
    expect(markdown).toContain('评估差距。');
    expect(markdown).toContain('## 发展建议');
    expect(markdown).toContain('规划提升。');
    expect(markdown).toContain('## 行动计划');
    expect(markdown).toContain('执行方案。');
  });
});

describe('normalizePersonalGrowthSections', () => {
  it('fills missing sections with placeholder content', () => {
    const partial = [
      { key: 'self_cognition', title: '自我认知', content: '有内容', completed: true },
    ];
    const result = normalizePersonalGrowthSections(partial as any);
    expect(result).toHaveLength(5);
    expect(result[0].completed).toBe(true);
    // Remaining sections are filled from order defaults
    expect(result[1].key).toBe('career_direction_analysis');
    expect(result[1].content).toBe('');
    expect(result[1].completed).toBe(false);
  });

  it('returns all sections in correct order even with empty input', () => {
    const result = normalizePersonalGrowthSections([]);
    expect(result).toHaveLength(5);
    expect(result.map((s) => s.key)).toEqual([
      'self_cognition',
      'career_direction_analysis',
      'match_assessment',
      'development_suggestions',
      'action_plan',
    ]);
  });
});

describe('createPersonalGrowthReportTemplate', () => {
  it('creates template with all 5 sections and action plan sub-sections', () => {
    const template = createPersonalGrowthReportTemplate();
    expect(template).toContain('# 个人职业成长报告');
    expect(template).toContain('## 自我认知');
    expect(template).toContain('## 职业方向分析');
    expect(template).toContain('## 匹配度判断');
    expect(template).toContain('## 发展建议');
    expect(template).toContain('## 行动计划');
    expect(template).toContain('### 短期行动（0-3个月）');
    expect(template).toContain('### 中期行动（3-9个月）');
    expect(template).toContain('### 长期行动（9-24个月）');
  });

  it('preserves existing content when sections are provided', () => {
    const existing = [
      { key: 'self_cognition', title: '自我认知', content: '已有分析内容', completed: true },
    ];
    const template = createPersonalGrowthReportTemplate(existing as any);
    expect(template).toContain('已有分析内容');
    expect(template).toContain('## 职业方向分析');
  });
});
