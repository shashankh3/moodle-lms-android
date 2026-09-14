const token = '361a3db9763129c3aeb89f0671e445c6';
const baseUrl = 'https://mh.unilearn.org.in';

async function moodleWs(wsfunction, params = {}) {
  const url = new URL(`${baseUrl}/webservice/rest/server.php`);
  url.searchParams.append('wstoken', token);
  url.searchParams.append('wsfunction', wsfunction);
  url.searchParams.append('moodlewsrestformat', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v);
  }
  const res = await fetch(url.toString());
  return await res.json();
}

async function testDirectUpload() {
  console.log('1. Getting unused draft itemid...');
  const draftRes = await moodleWs('core_files_get_unused_draft_itemid', {});
  console.log('Draft response:', draftRes);
  const draftId = draftRes.itemid;

  console.log('2. Uploading file to upload.php using native FormData & Blob...');
  const form = new FormData();
  form.append('token', token);
  form.append('filearea', 'draft');
  form.append('itemid', draftId.toString());
  form.append('filepath', '/');
  form.append('filename', 'test_node_upload.txt');

  const blob = new Blob(['Hello this is a test upload to private files from node at ' + new Date().toISOString()], { type: 'text/plain' });
  form.append('file', blob, 'test_node_upload.txt');

  const uploadRes = await fetch(`${baseUrl}/webservice/upload.php`, {
    method: 'POST',
    body: form,
  });

  const uploadText = await uploadRes.text();
  console.log('Upload HTTP status:', uploadRes.status);
  console.log('Upload response text:', uploadText);

  let uploadJson;
  try {
    uploadJson = JSON.parse(uploadText);
  } catch (e) {
    console.error('Failed to parse upload response as JSON');
  }

  console.log('3. Committing draft to private files via core_user_add_user_private_files...');
  const commitRes = await moodleWs('core_user_add_user_private_files', { draftid: draftId });
  console.log('Commit response:', commitRes);

  console.log('4. Checking files in private area...');
  const filesRes = await moodleWs('core_files_get_files', {
    contextid: draftRes.contextid,
    component: 'user',
    filearea: 'private',
    itemid: 0,
    filepath: '/',
    filename: ''
  });
  console.log('Files now in private area:', filesRes?.files?.map(f => f.filename));
}

testDirectUpload().catch(console.error);
