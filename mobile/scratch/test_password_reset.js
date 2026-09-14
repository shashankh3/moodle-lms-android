const token = process.env.EXPO_PUBLIC_MOODLE_TOKEN || 'YOUR_TOKEN_HERE';
const baseUrl = 'https://mh.unilearn.org.in';

async function testPasswordReset() {
  const url = `${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_auth_request_password_reset&moodlewsrestformat=json`;
  const res = await fetch(url, {
    method: 'POST',
    body: new URLSearchParams({
      username: 'sonalib',
    })
  }).then(r => r.json());
  console.log('Password reset test result:', res);
}

testPasswordReset().catch(console.error);
