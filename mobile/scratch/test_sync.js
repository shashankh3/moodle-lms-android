const fetch = require('node-fetch');

const token = '361a3db9763129c3aeb89f0671e445c6';
const baseUrl = 'https://mh.unilearn.org.in';
const userId = 14;

async function callMoodle(wsfunction, params = {}) {
  const url = new URL(`${baseUrl}/webservice/rest/server.php`);
  url.searchParams.append('wstoken', token);
  url.searchParams.append('wsfunction', wsfunction);
  url.searchParams.append('moodlewsrestformat', 'json');
  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }
  const res = await fetch(url.toString(), { method: 'POST' });
  const data = await res.json();
  if (data.exception) {
    console.error(`Error in ${wsfunction}:`, data.message);
  }
  return data;
}

async function testSync() {
  console.log('1. Getting user private files info...');
  const quota = await callMoodle('core_user_get_private_files_info', { userid: userId });
  console.log('Quota Info:', quota);

  console.log('\n2. Getting unused draft itemid...');
  const draft = await callMoodle('core_files_get_unused_draft_itemid', {});
  console.log('Draft Info:', draft);

  if (draft && draft.contextid) {
    console.log(`\n3. Getting files with contextid ${draft.contextid}...`);
    const files = await callMoodle('core_files_get_files', {
      contextid: draft.contextid,
      component: 'user',
      filearea: 'private',
      itemid: 0,
      filepath: '/',
      filename: ''
    });
    console.log('Files Info:');
    if (files.parents) {
      console.log('Parents:', files.parents.length);
      console.log('Files:', files.files.map(f => f.filename));
    } else {
      console.log(files);
    }
  }
}

testSync().catch(console.error);
