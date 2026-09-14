const fetch = require('node-fetch');
const FormData = require('form-data');

const token = process.env.EXPO_PUBLIC_MOODLE_TOKEN || 'YOUR_TOKEN_HERE';
const baseUrl = 'https://mh.unilearn.org.in';

async function testUpload() {
  const wsUrl = `${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_unused_draft_itemid&moodlewsrestformat=json`;
  const draftRes = await fetch(wsUrl).then(r => r.json());
  const draftId = draftRes.itemid;
  console.log('Draft ID:', draftId);

  const formData = new FormData();
  formData.append('token', token);
  formData.append('filearea', 'draft');
  formData.append('itemid', draftId.toString());
  formData.append('filepath', '/');
  formData.append('filename', 'hello.txt');
  
  // Create a buffer for the text file
  const buffer = Buffer.from('Hello Moodle from Node.js!', 'utf-8');
  formData.append('file_box', buffer, { filename: 'hello.txt', contentType: 'text/plain' });

  const uploadRes = await fetch(`${baseUrl}/webservice/upload.php`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json());
  
  console.log('Upload Response:', uploadRes);

  const commitUrl = `${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_user_add_user_private_files&moodlewsrestformat=json`;
  const commitFormData = new URLSearchParams();
  commitFormData.append('draftid', draftId);
  const commitRes = await fetch(commitUrl, { method: 'POST', body: commitFormData }).then(r => r.json());
  console.log('Commit Response:', commitRes);
}

testUpload().catch(console.error);
