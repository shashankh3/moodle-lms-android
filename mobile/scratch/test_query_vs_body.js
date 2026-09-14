const token = '361a3db9763129c3aeb89f0671e445c6';
const baseUrl = 'https://mh.unilearn.org.in';

async function testUploadQueryVsBody() {
  // Test A: Token & filearea & itemid in URL Query string
  const draftResA = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_unused_draft_itemid&moodlewsrestformat=json`).then(r => r.json());
  const draftIdA = draftResA.itemid;
  console.log('Draft A:', draftIdA);

  const urlA = `${baseUrl}/webservice/upload.php?token=${token}&filearea=draft&itemid=${draftIdA}&filepath=/&filename=query_test.txt`;
  const formA = new FormData();
  formA.append('file', new Blob(['Hello Query Params Test']), 'query_test.txt');

  const resA = await fetch(urlA, { method: 'POST', body: formA });
  console.log('Res A status:', resA.status, 'text:', await resA.text());

  // Test B: Token & filearea in Body
  const draftResB = await fetch(`${baseUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_files_get_unused_draft_itemid&moodlewsrestformat=json`).then(r => r.json());
  const draftIdB = draftResB.itemid;
  console.log('Draft B:', draftIdB);

  const urlB = `${baseUrl}/webservice/upload.php`;
  const formB = new FormData();
  formB.append('token', token);
  formB.append('filearea', 'draft');
  formB.append('itemid', draftIdB.toString());
  formB.append('filepath', '/');
  formB.append('filename', 'body_test.txt');
  formB.append('file', new Blob(['Hello Body Params Test']), 'body_test.txt');

  const resB = await fetch(urlB, { method: 'POST', body: formB });
  console.log('Res B status:', resB.status, 'text:', await resB.text());
}

testUploadQueryVsBody().catch(console.error);
