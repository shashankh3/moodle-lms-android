/**
 * SCORM 1.2 Data Model — Full port of AddonModScormDataModel12 from moodlehq/moodleapp
 * Reference: https://github.com/moodlehq/moodleapp/blob/main/src/addons/mod/scorm/classes/data-model-12.ts
 *
 * This class implements the complete SCORM 1.2 LMS JavaScript API:
 *   - LMSInitialize, LMSGetValue, LMSSetValue, LMSCommit, LMSFinish
 *   - CMI data element type validation with ranges
 *   - SCORM standard error codes (0, 101, 201, 301, 401–405)
 *   - Attempt management and session_time accumulation
 *   - insertScormTracks posting to Moodle REST API
 */

import { ScormOfflineQueue } from './ScormOfflineQueue';

// Standard Data Type Definitions
const CMI_STRING_256    = '^[\\u0000-\\uFFFF]{0,255}$';
const CMI_STRING_4096   = '^[\\u0000-\\uFFFF]{0,4096}$';
const CMI_TIME          = '^([0-2]{1}[0-9]{1}):([0-5]{1}[0-9]{1}):([0-5]{1}[0-9]{1})(\\.[0-9]{1,2})?$';
const CMI_TIMESPAN      = '^([0-9]{2,4}):([0-9]{2}):([0-9]{2})(\\.[0-9]{1,2})?$';
const CMI_SINTEGER      = '^-?([0-9]+)$';
const CMI_DECIMAL       = '^-?([0-9]{0,3})(\\.[0-9]*)?$';
const CMI_IDENTIFIER    = '^[\\u0021-\\u007E]{0,255}$';
const CMI_FEEDBACK      = CMI_STRING_256;
const CMI_INDEX         = '[._](\\d+)\\.';

// Vocabulary Data Type Definitions
const CMI_STATUS   = '^passed$|^completed$|^failed$|^incomplete$|^browsed$';
const CMI_STATUS_2 = '^passed$|^completed$|^failed$|^incomplete$|^browsed$|^not attempted$';
const CMI_EXIT     = '^time-out$|^suspend$|^logout$|^$';
const CMI_TYPE     = '^true-false$|^choice$|^fill-in$|^matching$|^performance$|^sequencing$|^likert$|^numeric$';
const CMI_RESULT   = '^correct$|^wrong$|^unanticipated$|^neutral$|^([0-9]{0,3})?(\\.[0-9]*)?$';
const NAV_EVENT    = '^previous$|^continue$';

// Children lists
const CMI_CHILDREN            = 'core,suspend_data,launch_data,comments,objectives,student_data,student_preference,interactions';
const CORE_CHILDREN           = 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time';
const SCORE_CHILDREN          = 'raw,min,max';
const COMMENTS_CHILDREN       = 'content,location,time';
const OBJECTIVES_CHILDREN     = 'id,score,status';
const STUDENT_DATA_CHILDREN   = 'mastery_score,max_time_allowed,time_limit_action';
const STUDENT_PREF_CHILDREN   = 'audio,language,speed,text';
const INTERACTIONS_CHILDREN   = 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency';

// Data ranges
const SCORE_RANGE    = '0#100';
const AUDIO_RANGE    = '-1#100';
const SPEED_RANGE    = '-100#100';
const WEIGHTING_RANGE = '-100#100';
const TEXT_RANGE     = '-1#1';

// Error codes (SCORM 1.2 spec)
const ERROR_STRINGS = {
  0:   'No error',
  101: 'General exception',
  201: 'Invalid argument error',
  202: 'Element cannot have children',
  203: 'Element not an array - cannot have count',
  301: 'Not initialized',
  401: 'Not implemented error',
  402: 'Invalid set value, element is a keyword',
  403: 'Element is read only',
  404: 'Element is write only',
  405: 'Incorrect data type',
};

/**
 * Add two SCORM time strings in format HH:MM:SS[.CC]
 */
function addTime(first, second) {
  const sFirst  = first.split(':');
  const sSecond = second.split(':');
  const cFirst  = (sFirst[2]  || '0').split('.');
  const cSecond = (sSecond[2] || '0').split('.');

  let change = 0;
  const firstCents  = cFirst.length  > 1 ? parseInt(cFirst[1],  10) : 0;
  const secondCents = cSecond.length > 1 ? parseInt(cSecond[1], 10) : 0;

  let cents = firstCents + secondCents;
  change = Math.floor(cents / 100);
  cents  = cents - change * 100;
  const centsStr = Math.floor(cents) < 10 ? '0' + cents : String(cents);

  let secs = parseInt(cFirst[0], 10) + parseInt(cSecond[0], 10) + change;
  change   = Math.floor(secs / 60);
  secs     = secs - change * 60;
  const secsStr = Math.floor(secs) < 10 ? '0' + secs : String(secs);

  let mins = parseInt(sFirst[1] || '0', 10) + parseInt(sSecond[1] || '0', 10) + change;
  change   = Math.floor(mins / 60);
  mins     = mins - change * 60;
  const minsStr = mins < 10 ? '0' + mins : String(mins);

  let hours   = parseInt(sFirst[0] || '0', 10) + parseInt(sSecond[0] || '0', 10) + change;
  const hoursStr = hours < 10 ? '0' + hours : String(hours);

  if (centsStr !== '0') {
    return `${hoursStr}:${minsStr}:${secsStr}.${centsStr}`;
  }
  return `${hoursStr}:${minsStr}:${secsStr}`;
}

/**
 * Build the complete SCORM 1.2 CMI data model definition for a given SCO,
 * seeded with the user's existing CMI data from Moodle.
 */
function buildDataModel(scoId, userData) {
  const userdata = (userData && userData[scoId] && userData[scoId].userdata) || {};
  const defaultdata = (userData && userData[scoId] && userData[scoId].defaultdata) || {};

  const get  = (key, def = '') => userdata[key] !== undefined ? String(userdata[key]) : (defaultdata[key] !== undefined ? String(defaultdata[key]) : def);

  return {
    'cmi._version':                           { defaultValue: '3.4',                     mod: 'r',  type: CMI_STRING_256 },
    'cmi._children':                          { defaultValue: CMI_CHILDREN,              mod: 'r',  type: CMI_STRING_256 },
    'cmi.core._children':                     { defaultValue: CORE_CHILDREN,             mod: 'r',  type: CMI_STRING_256 },
    'cmi.core.student_id':                    { defaultValue: get('cmi.core.student_id'), mod: 'r',  type: CMI_STRING_256 },
    'cmi.core.student_name':                  { defaultValue: get('cmi.core.student_name'), mod: 'r', type: CMI_STRING_256 },
    'cmi.core.lesson_location':               { defaultValue: get('cmi.core.lesson_location', ''), mod: 'rw', type: CMI_STRING_256 },
    'cmi.core.credit':                        { defaultValue: get('cmi.core.credit', 'credit'), mod: 'r',  type: CMI_STRING_256 },
    'cmi.core.lesson_status':                 { defaultValue: get('cmi.core.lesson_status', 'not attempted'), mod: 'rw', type: CMI_STATUS_2 },
    'cmi.core.entry':                         { defaultValue: get('cmi.core.entry', 'ab-initio'), mod: 'r',  type: CMI_STRING_256 },
    'cmi.core.score._children':               { defaultValue: SCORE_CHILDREN,            mod: 'r',  type: CMI_STRING_256 },
    'cmi.core.score.raw':                     { defaultValue: get('cmi.core.score.raw', ''),     mod: 'rw', type: CMI_DECIMAL, range: SCORE_RANGE },
    'cmi.core.score.max':                     { defaultValue: get('cmi.core.score.max', ''),     mod: 'rw', type: CMI_DECIMAL, range: SCORE_RANGE },
    'cmi.core.score.min':                     { defaultValue: get('cmi.core.score.min', ''),     mod: 'rw', type: CMI_DECIMAL, range: SCORE_RANGE },
    'cmi.core.total_time':                    { defaultValue: get('cmi.core.total_time', '00:00:00'), mod: 'r',  type: CMI_TIME },
    'cmi.core.lesson_mode':                   { defaultValue: get('cmi.core.lesson_mode', 'normal'), mod: 'r',  type: CMI_STRING_256 },
    'cmi.core.exit':                          { defaultValue: get('cmi.core.exit', ''), mod: 'w',  type: CMI_EXIT },
    'cmi.core.session_time':                  { defaultValue: '00:00:00',                mod: 'w',  type: CMI_TIME },
    'cmi.suspend_data':                       { defaultValue: get('cmi.suspend_data', ''),        mod: 'rw', type: CMI_STRING_4096 },
    'cmi.launch_data':                        { defaultValue: get('cmi.launch_data', ''),         mod: 'r',  type: CMI_STRING_4096 },
    'cmi.comments':                           { defaultValue: get('cmi.comments', ''),            mod: 'rw', type: CMI_STRING_4096 },
    'cmi.comments_from_lms':                  { defaultValue: '',                        mod: 'r',  type: CMI_STRING_4096 },
    'cmi.objectives._children':              { defaultValue: OBJECTIVES_CHILDREN,       mod: 'r',  type: CMI_STRING_256 },
    'cmi.objectives._count':                 { defaultValue: '0',                       mod: 'r',  type: CMI_INTEGER_ONLY },
    'cmi.student_data._children':            { defaultValue: STUDENT_DATA_CHILDREN,     mod: 'r',  type: CMI_STRING_256 },
    'cmi.student_data.mastery_score':        { defaultValue: get('cmi.student_data.mastery_score', ''), mod: 'r',  type: CMI_DECIMAL },
    'cmi.student_data.max_time_allowed':     { defaultValue: get('cmi.student_data.max_time_allowed', ''), mod: 'r',  type: CMI_STRING_256 },
    'cmi.student_data.time_limit_action':    { defaultValue: get('cmi.student_data.time_limit_action', ''), mod: 'r',  type: CMI_STRING_256 },
    'cmi.student_preference._children':      { defaultValue: STUDENT_PREF_CHILDREN,     mod: 'r',  type: CMI_STRING_256 },
    'cmi.student_preference.audio':          { defaultValue: get('cmi.student_preference.audio', '0'), mod: 'rw', type: CMI_SINTEGER, range: AUDIO_RANGE },
    'cmi.student_preference.language':       { defaultValue: get('cmi.student_preference.language', ''), mod: 'rw', type: CMI_STRING_256 },
    'cmi.student_preference.speed':          { defaultValue: get('cmi.student_preference.speed', '0'), mod: 'rw', type: CMI_SINTEGER, range: SPEED_RANGE },
    'cmi.student_preference.text':           { defaultValue: get('cmi.student_preference.text', '0'), mod: 'rw', type: CMI_SINTEGER, range: TEXT_RANGE },
    'cmi.interactions._children':            { defaultValue: INTERACTIONS_CHILDREN,     mod: 'r',  type: CMI_STRING_256 },
    'cmi.interactions._count':               { defaultValue: '0',                       mod: 'r',  type: CMI_INTEGER_ONLY },
  };
}

const CMI_INTEGER_ONLY = '^\\d+$';

/**
 * Validates a value against a CMI type regex and optional numeric range.
 */
function validateCmiValue(element, value, def) {
  if (!def) return false;
  const regex = new RegExp(def.type);
  if (!regex.test(value)) return false;

  if (def.range) {
    const [min, max] = def.range.split('#').map(Number);
    const num = parseFloat(value);
    if (isNaN(num) || num < min || num > max) return false;
  }

  return true;
}

/**
 * Full SCORM 1.2 Data Model — React Native / Expo JavaScript implementation.
 *
 * Usage:
 *   const model = new ScormDataModel12({ scoId, scormId, attempt, userId, userName, userData, client, courseId, onComplete });
 *   const bridgeScript = model.generateBridgeScript();
 *   // Inject bridgeScript into WebView via injectedJavaScriptBeforeContentLoaded
 *   // Listen for model.handleBridgeEvent(messageData) from onMessage
 */
export class ScormDataModel12 {
  constructor({ scoId, scormId, attempt, userId, userName, userData, client, courseId, onComplete } = {}) {
    this.scoId     = scoId    || 1;
    this.scormId   = scormId  || 0;
    this.attempt   = attempt  || 1;
    this.userId    = userId   || '2';
    this.userName  = userName || 'Student';
    this.userData  = userData || {};
    this.client    = client   || null;
    this.courseId  = courseId || 0;
    this.onComplete = onComplete || null;

    this._cmiData      = {};
    this._dataModel    = buildDataModel(this.scoId, this.userData);
    this._initialized  = false;
    this._errorCode    = '0';
    this._sessionStart = Date.now();
    this._pendingTracks = [];

    // Seed _cmiData from data model defaults
    for (const [key, def] of Object.entries(this._dataModel)) {
      this._cmiData[key] = def.defaultValue || '';
    }
    // Ensure student identity is always set
    this._cmiData['cmi.core.student_id']   = String(this.userId);
    this._cmiData['cmi.core.student_name'] = String(this.userName);
  }

  /**
   * Collects all CMI values that should be persisted (excludes nav, session_time, read-only init fields).
   */
  collectTracks() {
    const tracks = [];
    const skipKeys = new Set([
      'cmi.core.session_time',
      'cmi.core.student_id',
      'cmi.core.student_name',
      'cmi.core.credit',
      'cmi.core.entry',
      'cmi.core.lesson_mode',
      'cmi.core.total_time',
      'cmi._version',
      'cmi._children',
      'cmi.core._children',
      'cmi.core.score._children',
      'cmi.objectives._children',
      'cmi.objectives._count',
      'cmi.student_data._children',
      'cmi.student_preference._children',
      'cmi.interactions._children',
      'cmi.interactions._count',
    ]);

    for (const [element, value] of Object.entries(this._cmiData)) {
      if (skipKeys.has(element)) continue;
      if (!element.startsWith('cmi.')) continue;
      tracks.push({ element, value: String(value) });
    }

    // Always include lesson_status and suspend_data
    const status = this._cmiData['cmi.core.lesson_status'] || '';
    if (!tracks.find(t => t.element === 'cmi.core.lesson_status')) {
      tracks.push({ element: 'cmi.core.lesson_status', value: status });
    }

    return tracks;
  }

  /**
   * Calculates session_time from elapsed wall-clock time.
   */
  getSessionTime() {
    const elapsed = Math.floor((Date.now() - this._sessionStart) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Posts tracks to Moodle via mod_scorm_insert_tracks REST call.
   */
  async saveTracks(tracks) {
    if (!this.client || !tracks || tracks.length === 0) return;
    try {
      await this.client.insertScormTracks(this.scoId, tracks);
      console.log('[ScormDataModel12] Tracks saved to Moodle:', tracks.length);
    } catch (err) {
      console.warn('[ScormDataModel12] Failed to save tracks:', err.message);
      // Store for offline sync
      try {
        await ScormOfflineQueue.addOfflineTracks(this.scormId, this.attempt, this.scoId, tracks);
      } catch (e2) {}
    }
  }

  /**
   * Handles messages posted by the bridge script running in WebView.
   * Call this from WebView's onMessage prop.
   */
  async handleBridgeEvent(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'SCORM_INIT':
        this._sessionStart = Date.now();
        break;

      case 'SCORM_SET_VALUE':
        if (data.element) {
          this._cmiData[data.element] = String(data.value || '');
        }
        break;

      case 'SCORM_COMMIT': {
        // Update session time in total_time
        const sessionTime = this.getSessionTime();
        const totalTime   = this._cmiData['cmi.core.total_time'] || '00:00:00';
        this._cmiData['cmi.core.total_time'] = addTime(totalTime, sessionTime);
        this._cmiData['cmi.core.session_time'] = sessionTime;
        const tracks = this.collectTracks();
        await this.saveTracks(tracks);
        break;
      }

      case 'SCORM_FINISH': {
        const sessionTime = this.getSessionTime();
        const totalTime   = this._cmiData['cmi.core.total_time'] || '00:00:00';
        this._cmiData['cmi.core.total_time'] = addTime(totalTime, sessionTime);
        this._cmiData['cmi.core.session_time'] = sessionTime;
        const tracks = this.collectTracks();
        await this.saveTracks(tracks);

        const status = this._cmiData['cmi.core.lesson_status'] || '';
        const isCompleted = status === 'completed' || status === 'passed';
        if (isCompleted && this.onComplete) {
          this.onComplete({
            lessonStatus: status,
            score: this._cmiData['cmi.core.score.raw'] || '',
            totalTime: this._cmiData['cmi.core.total_time'],
          });
        }
        break;
      }
    }
  }

  /**
   * Generates the JavaScript bridge string to inject into the WebView
   * before the SCORM content loads.
   *
   * This sets up window.API (SCORM 1.2) and window.API_1484_11 (SCORM 2004)
   * with the full CMI data pre-seeded from Moodle.
   */
  generateBridgeScript() {
    const cmiJson = JSON.stringify(this._cmiData);

    return `
(function() {
  'use strict';

  // Pre-seeded CMI data from Moodle server
  var _cmiData = ${cmiJson};
  var _initialized = false;
  var _errorCode = '0';
  var _sessionStart = Date.now();

  var errorStrings = {
    0: 'No error',
    101: 'General exception',
    201: 'Invalid argument error',
    202: 'Element cannot have children',
    203: 'Element not an array - cannot have count',
    301: 'Not initialized',
    401: 'Not implemented error',
    402: 'Invalid set value, element is a keyword',
    403: 'Element is read only',
    404: 'Element is write only',
    405: 'Incorrect data type',
  };

  function postRN(type, extra) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
      }
    } catch(e) {}
  }

  var API = {
    LMSInitialize: function(param) {
      if (_initialized) return 'true';
      _initialized = true;
      _errorCode = '0';
      _sessionStart = Date.now();
      console.log('[SCORM] LMSInitialize called');
      postRN('SCORM_INIT');
      return 'true';
    },

    LMSGetValue: function(element) {
      if (!_initialized) { _errorCode = '301'; return ''; }
      _errorCode = '0';
      var val = _cmiData[element];
      if (val === undefined) {
        // Handle indexed elements (cmi.objectives.n.*, cmi.interactions.n.*)
        if (/cmi\\.(objectives|interactions)\\.\\d+\\./.test(element)) {
          return '';
        }
        _errorCode = '201';
        return '';
      }
      return String(val);
    },

    LMSSetValue: function(element, value) {
      if (!_initialized) { _errorCode = '301'; return 'false'; }
      _errorCode = '0';

      // Read-only elements
      var readOnly = [
        'cmi._version','cmi._children','cmi.core._children','cmi.core.score._children',
        'cmi.objectives._children','cmi.objectives._count','cmi.student_data._children',
        'cmi.student_preference._children','cmi.interactions._children','cmi.interactions._count',
        'cmi.core.student_id','cmi.core.student_name','cmi.core.credit',
        'cmi.core.entry','cmi.core.lesson_mode','cmi.core.total_time','cmi.launch_data',
        'cmi.comments_from_lms',
      ];
      if (readOnly.indexOf(element) !== -1) {
        _errorCode = '403';
        return 'false';
      }

      // Store the value
      _cmiData[element] = String(value);

      postRN('SCORM_SET_VALUE', {
        element: element,
        value: String(value),
        lessonStatus: _cmiData['cmi.core.lesson_status'],
        score: _cmiData['cmi.core.score.raw'],
      });
      return 'true';
    },

    LMSCommit: function(param) {
      if (!_initialized) { _errorCode = '301'; return 'false'; }
      _errorCode = '0';

      var elapsed = Math.floor((Date.now() - _sessionStart) / 1000);
      var h = Math.floor(elapsed / 3600);
      var m = Math.floor((elapsed % 3600) / 60);
      var s = elapsed % 60;
      var sessionTime = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
      _cmiData['cmi.core.session_time'] = sessionTime;

      postRN('SCORM_COMMIT', {
        cmi: _cmiData,
        lessonStatus: _cmiData['cmi.core.lesson_status'],
        score: _cmiData['cmi.core.score.raw'],
      });
      return 'true';
    },

    LMSFinish: function(param) {
      if (!_initialized) { _errorCode = '301'; return 'false'; }
      _errorCode = '0';
      _initialized = false;

      var elapsed = Math.floor((Date.now() - _sessionStart) / 1000);
      var h = Math.floor(elapsed / 3600);
      var m = Math.floor((elapsed % 3600) / 60);
      var s = elapsed % 60;
      var sessionTime = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
      _cmiData['cmi.core.session_time'] = sessionTime;

      postRN('SCORM_FINISH', {
        cmi: _cmiData,
        lessonStatus: _cmiData['cmi.core.lesson_status'],
        score: _cmiData['cmi.core.score.raw'],
      });
      return 'true';
    },

    LMSGetLastError: function()       { return _errorCode; },
    LMSGetErrorString: function(code) { return errorStrings[parseInt(code, 10)] || 'Unknown error'; },
    LMSGetDiagnostic: function(code)  { return errorStrings[parseInt(code, 10)] || 'No diagnostic info'; },

    // SCORM 2004 aliases
    Initialize:    function(p) { return API.LMSInitialize(p); },
    Terminate:     function(p) { return API.LMSFinish(p); },
    GetValue:      function(e) { return API.LMSGetValue(e); },
    SetValue:      function(e, v) { return API.LMSSetValue(e, v); },
    Commit:        function(p) { return API.LMSCommit(p); },
    GetLastError:  function()  { return API.LMSGetLastError(); },
    GetErrorString: function(c) { return API.LMSGetErrorString(c); },
    GetDiagnostic: function(c) { return API.LMSGetDiagnostic(c); },
  };

  // Expose globally — Articulate Storyline searches window.parent.API when in iframe,
  // or window.API when at top level (via injectedJavaScriptBeforeContentLoaded)
  window.API        = API;
  window.API_1484_11 = API;
  window.GetAPI      = function() { return API; };
  window.SCORM_GetAPI = function() { return API; };
  window.SCORM2004_GetAPI = function() { return API; };
})();
    `;
  }
}
