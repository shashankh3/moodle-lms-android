import { MoodleClient, setAuthErrorHandler, isTokenError } from '../src/services/moodleClient';

function mockFetchWithData(data, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

afterEach(() => {
  setAuthErrorHandler(null);
  jest.restoreAllMocks();
});

describe('isTokenError', () => {
  it('detects known token errorcodes', () => {
    expect(isTokenError({ errorcode: 'invalidtoken' })).toBe(true);
    expect(isTokenError({ errorcode: 'tokenexpired' })).toBe(true);
    expect(isTokenError({ errorcode: 'invalidtokenexpired' })).toBe(true);
  });

  it('detects token errors from the message text', () => {
    expect(isTokenError({ message: 'Invalid token' })).toBe(true);
    expect(isTokenError({ message: 'Access token expired' })).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isTokenError({ errorcode: 'requirelogin', message: 'You are not logged in' })).toBe(false);
    expect(isTokenError({ message: 'Database error' })).toBe(false);
    expect(isTokenError(null)).toBe(false);
  });
});

describe('token expiry auto-logout hook', () => {
  it('notifies the registered handler on invalidtoken and flags the error', async () => {
    const handler = jest.fn();
    setAuthErrorHandler(handler);
    mockFetchWithData({
      exception: 'moodle_exception',
      errorcode: 'invalidtoken',
      message: 'Invalid token',
    });

    const client = new MoodleClient('https://mh.unilearn.org.in', 'bad-token');
    await expect(client.call('core_webservice_get_site_info')).rejects.toMatchObject({
      isAuthError: true,
      errorcode: 'invalidtoken',
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].isAuthError).toBe(true);
  });

  it('does not notify for non-auth Moodle exceptions', async () => {
    const handler = jest.fn();
    setAuthErrorHandler(handler);
    mockFetchWithData({
      exception: 'moodle_exception',
      errorcode: 'requirelogin',
      message: 'You are not logged in',
    });

    const client = new MoodleClient('https://mh.unilearn.org.in', 'tok');
    await expect(client.call('core_enrol_get_users_courses')).rejects.toMatchObject({
      errorcode: 'requirelogin',
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
