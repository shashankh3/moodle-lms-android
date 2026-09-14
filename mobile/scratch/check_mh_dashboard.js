async function checkDashboardUrl() {
  const url = 'https://mh.unilearn.org.in/dashboard/';
  const res = await fetch(url);
  const text = await res.text();
  console.log('Full HTML:', text);
}

checkDashboardUrl().catch(console.error);
