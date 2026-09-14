const token = '361a3db9763129c3aeb89f0671e445c6';
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
