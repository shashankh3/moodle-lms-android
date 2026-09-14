jest.mock('../src/services/scorm/ScormOfflineQueue', () => ({
  ScormOfflineQueue: { addOfflineTracks: jest.fn().mockResolvedValue(undefined) },
}));

import { ScormDataModel12 } from '../src/services/scorm/ScormDataModel12';
import { ScormOfflineQueue } from '../src/services/scorm/ScormOfflineQueue';

const makeClient = () => ({ insertScormTracks: jest.fn().mockResolvedValue(true) });

const makeModel = (overrides = {}) => {
  const client = makeClient();
  const model = new ScormDataModel12({
    scoId: 7,
    scormId: 3,
    attempt: 2,
    userId: '42',
    userName: 'Jane Learner',
    client,
    ...overrides,
  });
  return { model, client };
};

describe('ScormDataModel12 constructor', () => {
  it('applies sensible defaults', () => {
    const model = new ScormDataModel12();
    expect(model.scoId).toBe(1);
    expect(model.attempt).toBe(1);
    expect(model.userId).toBe('2');
    expect(model.userName).toBe('Student');
  });

  it('seeds CMI identity from the user', () => {
    const { model } = makeModel();
    expect(model._cmiData['cmi.core.student_id']).toBe('42');
    expect(model._cmiData['cmi.core.student_name']).toBe('Jane Learner');
  });

  it('seeds CMI values from Moodle user data', () => {
    const model = new ScormDataModel12({
      scoId: 7,
      userData: {
        7: {
          userdata: {
            'cmi.core.lesson_status': 'incomplete',
            'cmi.core.score.raw': '55',
            'cmi.suspend_data': 'susp-xyz',
          },
        },
      },
    });
    expect(model._cmiData['cmi.core.lesson_status']).toBe('incomplete');
    expect(model._cmiData['cmi.core.score.raw']).toBe('55');
    expect(model._cmiData['cmi.suspend_data']).toBe('susp-xyz');
    expect(model._cmiData['cmi.core.entry']).toBe('ab-initio');
  });
});

describe('collectTracks', () => {
  it('excludes identity, bookkeeping and children elements', () => {
    const { model } = makeModel();
    const elements = model.collectTracks().map(t => t.element);
    expect(elements).not.toContain('cmi.core.student_id');
    expect(elements).not.toContain('cmi.core.student_name');
    expect(elements).not.toContain('cmi.core.session_time');
    expect(elements).not.toContain('cmi.core.total_time');
    expect(elements).not.toContain('cmi._children');
    expect(elements).not.toContain('cmi.objectives._count');
  });

  it('always includes lesson_status', () => {
    const { model } = makeModel();
    const status = model.collectTracks().find(t => t.element === 'cmi.core.lesson_status');
    expect(status).toBeDefined();
    expect(status.value).toBe('not attempted');
  });
});

describe('handleBridgeEvent', () => {
  it('stores values from SCORM_SET_VALUE', async () => {
    const { model } = makeModel();
    await model.handleBridgeEvent({ type: 'SCORM_SET_VALUE', element: 'cmi.core.lesson_status', value: 'completed' });
    expect(model._cmiData['cmi.core.lesson_status']).toBe('completed');
  });

  it('commits tracks to Moodle on SCORM_COMMIT', async () => {
    const { model, client } = makeModel();
    await model.handleBridgeEvent({ type: 'SCORM_SET_VALUE', element: 'cmi.core.lesson_status', value: 'passed' });
    await model.handleBridgeEvent({ type: 'SCORM_COMMIT' });

    expect(client.insertScormTracks).toHaveBeenCalledTimes(1);
    const [scoId, tracks] = client.insertScormTracks.mock.calls[0];
    expect(scoId).toBe(7);
    const statusTrack = tracks.find(t => t.element === 'cmi.core.lesson_status');
    expect(statusTrack.value).toBe('passed');
  });

  it('accumulates total_time on commit', async () => {
    const { model } = makeModel();
    model._cmiData['cmi.core.total_time'] = '01:00:30';
    model._sessionStart = Date.now() - 90 * 1000; // 90s session
    await model.handleBridgeEvent({ type: 'SCORM_COMMIT' });
    // addTime appends '.00' cents for whole seconds (parity with moodlehq upstream)
    expect(model._cmiData['cmi.core.total_time']).toBe('01:02:00.00');
  });

  it('fires onComplete on SCORM_FINISH when the status is completed', async () => {
    const onComplete = jest.fn();
    const { model } = makeModel({ onComplete });
    await model.handleBridgeEvent({ type: 'SCORM_SET_VALUE', element: 'cmi.core.lesson_status', value: 'passed' });
    await model.handleBridgeEvent({ type: 'SCORM_SET_VALUE', element: 'cmi.core.score.raw', value: '95' });
    await model.handleBridgeEvent({ type: 'SCORM_FINISH' });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ lessonStatus: 'passed', score: '95' })
    );
  });

  it('does not fire onComplete on failed status', async () => {
    const onComplete = jest.fn();
    const { model } = makeModel({ onComplete });
    await model.handleBridgeEvent({ type: 'SCORM_SET_VALUE', element: 'cmi.core.lesson_status', value: 'failed' });
    await model.handleBridgeEvent({ type: 'SCORM_FINISH' });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('queues tracks offline when the Moodle call fails', async () => {
    const client = { insertScormTracks: jest.fn().mockRejectedValue(new Error('Network request failed')) };
    const model = new ScormDataModel12({ scoId: 7, scormId: 3, attempt: 2, client });
    await model.handleBridgeEvent({ type: 'SCORM_SET_VALUE', element: 'cmi.core.lesson_status', value: 'completed' });
    await model.handleBridgeEvent({ type: 'SCORM_COMMIT' });

    expect(ScormOfflineQueue.addOfflineTracks).toHaveBeenCalledWith(
      3,
      2,
      7,
      expect.arrayContaining([expect.objectContaining({ element: 'cmi.core.lesson_status' })])
    );
  });

  it('ignores unknown or empty events', async () => {
    const { model, client } = makeModel();
    await model.handleBridgeEvent(null);
    await model.handleBridgeEvent({});
    await model.handleBridgeEvent({ type: 'SOMETHING_ELSE' });
    expect(client.insertScormTracks).not.toHaveBeenCalled();
  });
});

describe('generateBridgeScript', () => {
  it('exposes SCORM 1.2 and 2004 APIs with pre-seeded CMI data', () => {
    const { model } = makeModel();
    const script = model.generateBridgeScript();
    expect(script).toContain('window.API');
    expect(script).toContain('window.API_1484_11');
    expect(script).toContain('"cmi.core.student_id":"42"');
    expect(script).toContain('LMSInitialize');
    expect(script).toContain('LMSFinish');
  });
});
