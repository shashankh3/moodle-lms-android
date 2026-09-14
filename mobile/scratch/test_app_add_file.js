const token = '361a3db9763129c3aeb89f0671e445c6';
const baseUrl = 'https://mh.unilearn.org.in';

async function testAppAddFile() {
  const fileData = {
    name: 'app_created_document.txt',
    content: 'This note was created inside the mobile app and synced to Moodle server private storage.',
  };

  // 1. Get draft ID
  const draftRes = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_unused_draft_itemid&moodlewsrestformat=json`).then(r => r.json());
  const draftId = draftRes.itemid;
  console.log('Got draftId:', draftId);

  // 2. Upload to upload.php
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const uploadUrl = `${cleanBaseUrl}/webservice/upload.php?token=${token}&filearea=draft&itemid=${draftId}&filepath=/&filename=${encodeURIComponent(fileData.name)}`;

  const formData = new FormData();
  formData.append('token', token);
  formData.append('filearea', 'draft');
  formData.append('itemid', draftId.toString());
  formData.append('filepath', '/');
  formData.append('filename', fileData.name);

  const blob = new Blob([fileData.content], { type: 'text/plain;charset=utf-8' });
  formData.append('file', blob, fileData.name);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const uploadText = await uploadRes.text();
  console.log('Upload Result:', uploadRes.status, uploadText);

  // 3. Commit draft
  const commitRes = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_user_add_user_private_files&draftid=${draftId}&moodlewsrestformat=json`).then(r => r.json());
  console.log('Commit Result:', commitRes);

  // 4. Verify in private files
  const filesRes = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_files&contextid=88&component=user&filearea=private&itemid=0&filepath=/&filename=&moodlewsrestformat=json`).then(r => r.json());
  console.log('Files in Private Area now:', filesRes.files.map(f => f.filename));
}

testAppAddFile().catch(console.error);
