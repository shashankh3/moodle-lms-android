/**
 * Moodle Quiz HTML Parser
 * Converts raw Moodle Web Services HTML into React Native consumable JSON objects.
 * Uses lightweight regex parsing for performance and zero-dependencies.
 */

export const MoodleQuizParser = {
  /**
   * Parse the HTML returned by mod_quiz_get_attempt_data or get_attempt_review.
   * @param {string} html The raw HTML string
   * @returns {object} Extracted question data
   */
  parseQuestionHtml(html) {
    if (!html) return null;

    const result = {
      type: 'unknown',
      prompt: '',
      options: [],
      sequenceCheckName: null,
      sequenceCheckValue: null,
      inputName: null, // the main 'name' for the answer(s)
      isMultipleAnswer: false,
    };

    // 1. Detect question type from outer class
    if (/class="[^"]*\bmultichoice\b[^"]*"/.test(html)) {
      result.type = 'multichoice';
    } else if (/class="[^"]*\btruefalse\b[^"]*"/.test(html)) {
      result.type = 'truefalse';
    } else if (/class="[^"]*\bshortanswer\b[^"]*"/.test(html)) {
      result.type = 'shortanswer';
    } else if (/class="[^"]*\bmatch\b[^"]*"/.test(html)) {
      result.type = 'match';
    }

    // 2. Extract sequencecheck (crucial for Moodle to accept the answer)
    // <input type="hidden" name="q123:1_:sequencecheck" value="1">
    const seqMatch = html.match(/<input[^>]*type="hidden"[^>]*name="([^"]+:sequencecheck)"[^>]*value="([^"]*)"/i) || 
                     html.match(/<input[^>]*name="([^"]+:sequencecheck)"[^>]*type="hidden"[^>]*value="([^"]*)"/i);
    if (seqMatch) {
      result.sequenceCheckName = seqMatch[1];
      result.sequenceCheckValue = seqMatch[2];
    }

    // 3. Extract question text (prompt)
    // <div class="qtext">...</div>
    const qtextMatch = html.match(/<div class="qtext">([\s\S]*?)<\/div>\s*<fieldset/i) || 
                       html.match(/<div class="qtext">([\s\S]*?)<\/div>/i);
    if (qtextMatch) {
      result.prompt = this._cleanText(qtextMatch[1]);
    }

    // 4. Extract options for Multichoice / TrueFalse
    if (result.type === 'multichoice' || result.type === 'truefalse') {
      // Find all radio or checkbox inputs
      const inputRegex = /<input[^>]*type="(radio|checkbox)"[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*id="([^"]+)"/gi;
      let match;
      while ((match = inputRegex.exec(html)) !== null) {
        const inputType = match[1];
        if (inputType === 'checkbox') result.isMultipleAnswer = true;
        
        result.inputName = match[2]; // e.g. "q123:1_answer"
        const optionValue = match[3];
        const inputId = match[4];

        // Find the label for this input ID to get the text
        // <label for="q123:1_answer0">Paris</label>
        const labelRegex = new RegExp(`<label[^>]*for="${inputId}"[^>]*>([\\s\\S]*?)<\/label>`, 'i');
        let labelMatch = html.match(labelRegex);
        
        if (!labelMatch) {
          const divLabelRegex = new RegExp(`id="${inputId}_label"[^>]*>([\\s\\S]*?)<\/div>`, 'i');
          labelMatch = html.match(divLabelRegex);
        }

        let optionText = labelMatch ? this._cleanText(labelMatch[1]) : `Option ${optionValue}`;

        // Sometimes the answer number (a., b., c.) is inside a span. We can strip it if we want, but keeping it is fine.
        result.options.push({
          id: optionValue,
          value: optionValue,
          text: optionText,
          inputName: match[2],
        });
      }
    }

    // 5. Extract Shortanswer
    if (result.type === 'shortanswer') {
      const inputMatch = html.match(/<input[^>]*type="text"[^>]*name="([^"]+)"/i);
      if (inputMatch) {
        result.inputName = inputMatch[1];
      }
    }

    // 6. Extract Match
    if (result.type === 'match') {
      result.subQuestions = [];
      result.options = []; // Shared options for all subquestions

      // Extract options from the first select element
      const firstSelectMatch = html.match(/<select[^>]*>([\s\S]*?)<\/select>/i);
      if (firstSelectMatch) {
        const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi;
        let optMatch;
        while ((optMatch = optionRegex.exec(firstSelectMatch[1])) !== null) {
          const val = optMatch[1];
          const text = this._cleanText(optMatch[2]);
          // Value "0" is usually the "Choose..." placeholder
          if (val !== "0") {
            result.options.push({ id: val, value: val, text: text });
          }
        }
      }

      // Extract each sub-question row
      const trRegex = /<tr[^>]*>[\s\S]*?<td[^>]*class="[^"]*\btext\b[^"]*"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*class="[^"]*\bcontrol\b[^"]*"[^>]*>[\s\S]*?<select[^>]*name="([^"]+)"/gi;
      let trMatch;
      let idx = 0;
      while ((trMatch = trRegex.exec(html)) !== null) {
        result.subQuestions.push({
          id: `sub_${idx++}`,
          text: this._cleanText(trMatch[1]),
          inputName: trMatch[2]
        });
      }
    }

    // Extract correct answer / feedback if in review mode
    const feedbackMatch = html.match(/<div class="rightanswer">([\s\S]*?)<\/div>/i);
    if (feedbackMatch) {
      result.correctAnswerText = this._cleanText(feedbackMatch[1]);
    }
    
    // Check if the user's answer was correct (review mode)
    if (/class="[^"]*\bcorrect\b[^"]*"/.test(html)) {
      result.isCorrect = true;
    } else if (/class="[^"]*\bincorrect\b[^"]*"/.test(html)) {
      result.isCorrect = false;
    } else if (/class="[^"]*\bpartiallycorrect\b[^"]*"/.test(html)) {
      result.isCorrect = false;
      result.isPartiallyCorrect = true;
    }

    return result;
  },

  /**
   * Helper to strip HTML tags and decode HTML entities from extracted text.
   */
  _cleanText(html) {
    if (!html) return '';
    let text = html.replace(/<[^>]+>/g, ' '); // Replace tags with space
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#039;/g, "'");
    text = text.replace(/\s{2,}/g, ' '); // Compress multiple spaces
    return text.trim();
  }
};
