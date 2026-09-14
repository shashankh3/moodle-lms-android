import { MoodleQuizParser } from '../src/services/moodleQuizParser';

const MULTICHOICE_HTML = `
<div class="que multichoice notyetanswered">
  <div class="qtext"><p>What is the capital of&nbsp;France?</p></div>
  <fieldset class="ablock">
    <div class="answer">
      <div class="r0">
        <input type="radio" name="q3:1_answer" value="0" id="q3:1_answer0">
        <label for="q3:1_answer0">Paris</label>
      </div>
      <div class="r1">
        <input type="radio" name="q3:1_answer" value="1" id="q3:1_answer1">
        <label for="q3:1_answer1">London</label>
      </div>
      <div class="r2">
        <input type="radio" name="q3:1_answer" value="2" id="q3:1_answer2">
        <label for="q3:1_answer2">Rome</label>
      </div>
    </div>
  </fieldset>
  <input type="hidden" name="q3:1_:sequencecheck" value="3">
</div>`;

const MULTIPLE_ANSWER_HTML = MULTICHOICE_HTML.replace(/type="radio"/g, 'type="checkbox"');

const TRUEFALSE_HTML = `
<div class="que truefalse notyetanswered">
  <div class="qtext"><p>The sky is blue.</p></div>
  <div class="answer">
    <input type="radio" name="q4:1_answer" value="0" id="q4:1_answer0">
    <label for="q4:1_answer0">True</label>
    <input type="radio" name="q4:1_answer" value="1" id="q4:1_answer1">
    <label for="q4:1_answer1">False</label>
  </div>
</div>`;

const SHORTANSWER_HTML = `
<div class="que shortanswer notyetanswered">
  <div class="qtext"><p>Name a primary colour.</p></div>
  <div class="answer">
    <input type="text" name="q5:1_answer" value="" id="q5:1_answer">
  </div>
</div>`;

const ESSAY_HTML = `
<div class="que essay notyetanswered">
  <div class="qtext"><p>Describe the water cycle.</p></div>
  <div class="ablock">
    <textarea id="q7:1_answer" name="q7:1_answer" rows="10" cols="60"></textarea>
  </div>
  <input type="hidden" name="q7:1_:sequencecheck" value="1">
</div>`;

describe('MoodleQuizParser.parseQuestionHtml', () => {
  it('returns null for empty input', () => {
    expect(MoodleQuizParser.parseQuestionHtml('')).toBeNull();
    expect(MoodleQuizParser.parseQuestionHtml(null)).toBeNull();
  });

  describe('multichoice', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml(MULTICHOICE_HTML);

    it('detects the type', () => {
      expect(parsed.type).toBe('multichoice');
    });

    it('extracts and cleans the prompt', () => {
      expect(parsed.prompt).toBe('What is the capital of France?');
    });

    it('extracts the sequencecheck', () => {
      expect(parsed.sequenceCheckName).toBe('q3:1_:sequencecheck');
      expect(parsed.sequenceCheckValue).toBe('3');
    });

    it('extracts all labelled options sharing the input name', () => {
      expect(parsed.options).toHaveLength(3);
      expect(parsed.inputName).toBe('q3:1_answer');
      expect(parsed.options[0]).toEqual({
        id: '0',
        value: '0',
        text: 'Paris',
        inputName: 'q3:1_answer',
      });
      expect(parsed.options.map(o => o.text)).toEqual(['Paris', 'London', 'Rome']);
      expect(parsed.isMultipleAnswer).toBe(false);
    });
  });

  it('marks checkbox questions as multiple answer', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml(MULTIPLE_ANSWER_HTML);
    expect(parsed.isMultipleAnswer).toBe(true);
  });

  it('parses truefalse questions', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml(TRUEFALSE_HTML);
    expect(parsed.type).toBe('truefalse');
    expect(parsed.prompt).toBe('The sky is blue.');
    expect(parsed.options.map(o => o.text)).toEqual(['True', 'False']);
  });

  it('parses shortanswer questions', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml(SHORTANSWER_HTML);
    expect(parsed.type).toBe('shortanswer');
    expect(parsed.inputName).toBe('q5:1_answer');
    expect(parsed.options).toHaveLength(0);
  });

  it('parses essay questions with their textarea name', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml(ESSAY_HTML);
    expect(parsed.type).toBe('essay');
    expect(parsed.prompt).toBe('Describe the water cycle.');
    expect(parsed.inputName).toBe('q7:1_answer');
    expect(parsed.sequenceCheckName).toBe('q7:1_:sequencecheck');
    expect(parsed.sequenceCheckValue).toBe('1');
  });

  it('detects essay via qtype-essay class too', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml(
      ESSAY_HTML.replace('class="que essay', 'class="que qtype-essay')
    );
    expect(parsed.type).toBe('essay');
    expect(parsed.inputName).toBe('q7:1_answer');
  });

  it('returns unknown type for unrecognised HTML', () => {
    const parsed = MoodleQuizParser.parseQuestionHtml('<div><p>Hello</p></div>');
    expect(parsed.type).toBe('unknown');
    expect(parsed.prompt).toBe('');
  });

  it('extracts review-mode feedback', () => {
    const html = MULTICHOICE_HTML.replace(
      '<input type="hidden"',
      '<div class="rightanswer">Correct: Paris</div><div class="correct">Well done</div><input type="hidden"'
    );
    const parsed = MoodleQuizParser.parseQuestionHtml(html);
    expect(parsed.correctAnswerText).toBe('Correct: Paris');
    expect(parsed.isCorrect).toBe(true);
  });

  it('decodes HTML entities', () => {
    expect(MoodleQuizParser._cleanText('A &amp; B &lt;C&gt; &quot;D&quot; &amp;#039;E&amp;#039;')).toBe('A & B <C> "D" \'E\'');
  });
});
