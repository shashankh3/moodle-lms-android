import { MoodleClient, normalizeMoodleUrl } from '../src/services/moodleClient';

describe('normalizeMoodleUrl', () => {
  it('returns the default server for empty values', () => {
    expect(normalizeMoodleUrl('')).toBe('https://mh.unilearn.org.in');
    expect(normalizeMoodleUrl(null)).toBe('https://mh.unilearn.org.in');
  });

  it('adds https:// for public hosts', () => {
    expect(normalizeMoodleUrl('mh.unilearn.org.in')).toBe('https://mh.unilearn.org.in');
    expect(normalizeMoodleUrl('  school.example.com  ')).toBe('https://school.example.com');
  });

  it('adds http:// only for local/private hosts', () => {
    expect(normalizeMoodleUrl('localhost:8080')).toBe('http://localhost:8080');
    expect(normalizeMoodleUrl('127.0.0.1/moodle')).toBe('http://127.0.0.1/moodle');
    expect(normalizeMoodleUrl('10.0.0.5')).toBe('http://10.0.0.5');
    expect(normalizeMoodleUrl('192.168.1.10/lms')).toBe('http://192.168.1.10/lms');
  });

  it('keeps an explicit scheme', () => {
    expect(normalizeMoodleUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeMoodleUrl('http://example.com')).toBe('http://example.com');
  });

  it('strips trailing slashes and known Moodle paths', () => {
    expect(normalizeMoodleUrl('https://example.com///')).toBe('https://example.com');
    expect(normalizeMoodleUrl('https://example.com/login/token.php')).toBe('https://example.com');
    expect(normalizeMoodleUrl('https://example.com/login/index.php')).toBe('https://example.com');
    expect(normalizeMoodleUrl('https://example.com/webservice/rest/server.php')).toBe('https://example.com');
  });
});

describe('MoodleClient', () => {
  it('uses the default server when no baseUrl is provided', () => {
    const client = new MoodleClient();
    expect(client.baseUrl).toBe('https://mh.unilearn.org.in');
    expect(client.token).toBe('');
  });

  it('normalizes and trims the token', () => {
    const client = new MoodleClient('example.com', '  abc123  ');
    expect(client.baseUrl).toBe('https://example.com');
    expect(client.token).toBe('abc123');
  });

  it('updates the token via setToken', () => {
    const client = new MoodleClient('example.com', 'old');
    client.setToken(' new-token ');
    expect(client.token).toBe('new-token');
  });
});
