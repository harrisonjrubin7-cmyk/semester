import { test, eq } from './harness';
import { checkText, checkQuestions, summary } from '../src/lib/a11yContentRules';

const rules = (t: string, o = {}) => checkText(t, 'syllabus', o).map((i) => i.rule);
test('clean text passes (control)', () => {
  eq(rules('# Course\n\n## Week 1\n\nRead [the reading list](https://example.edu/list) and the ![diagram of the cell](cell.png).'), []);
});
test('each rule fires on its case', () => {
  eq(rules('See ![](chart.png)'), ['image-alt']);
  eq(rules('Read it [here](https://x.edu)'), ['link-text']);
  eq(rules('Go to https://x.edu/readings now'), ['bare-url']);
  eq(rules('# Title\n#### Deep'), ['heading-order']);
  eq(rules('THIS IS VERY IMPORTANT PLEASE READ'), ['all-caps']);
  eq(rules('Answer the questions marked in red.'), ['colour-only']);
  eq(rules('Watch [lecture 1](https://youtube.com/watch?v=1)'), ['media-captions']);
  eq(rules('x'.repeat(1300)), ['long-paragraph']);
});
test('captions mentioned clears the media warning; materials may be a bare URL', () => {
  eq(rules('Watch [lecture 1](https://youtube.com/watch?v=1) (captions on)'), []);
  eq(rules('https://x.edu/readings', { allowBareUrl: true }), []);
});
test('questions: image options without alt are errors, duplicate options warn', () => {
  const s = summary(checkQuestions([{ prompt: 'Which is a mitochondrion?', options: ['![](a.png)', 'Nucleus'] }, { prompt: 'Pick one', options: ['Yes', 'yes '] }], 'Quiz'));
  eq(s, { errors: 1, warnings: 1, info: 0 });
});
