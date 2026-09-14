const token = process.env.EXPO_PUBLIC_MOODLE_TOKEN || 'YOUR_TOKEN_HERE';
const baseUrl = 'https://mh.unilearn.org.in';

async function testRawMultipart() {
  const draftRes = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_unused_draft_itemid&moodlewsrestformat=json`).then(r => r.json());
  const draftId = draftRes.itemid;
  console.log('Draft ID:', draftId);

  const filename = 'pure_js_multipart.txt';
  const content = 'This is a pure JS multipart upload that works 100% reliably everywhere in React Native!';
  const boundary = '----ReactNativeBoundary' + Date.now().toString(16);

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="token"\r\n\r\n${token}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="filearea"\r\n\r\ndraft\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="itemid"\r\n\r\n${draftId}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="filepath"\r\n\r\n/\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="filename"\r\n\r\n${filename}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
  body += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  body += `${content}\r\n`;
  body += `--${boundary}--\r\n`;

  const uploadUrl = `${baseUrl}/webservice/upload.php?token=${token}&filearea=draft&itemid=${draftId}&filepath=/&filename=${encodeURIComponent(filename)}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: body,
  });

  const resText = await uploadRes.text();
  console.log('Pure JS Multipart Status:', uploadRes.status, 'Response:', resText);

  // Commit
  const commitRes = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_user_add_user_private_files&draftid=${draftId}&moodlewsrestformat=json`).then(r => r.json());
  console.log('Commit Result:', commitRes);

  // Check
  const filesRes = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_files&contextid=88&component=user&filearea=private&itemid=0&filepath=/&filename=&moodlewsrestformat=json`).then(r => r.json());
  console.log('Files now on server:', filesRes.files.map(f => f.filename));
}

testRawMultipart().catch(console.error);
