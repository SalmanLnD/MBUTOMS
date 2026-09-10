const url = 'http://localhost:5000/api/debug/class-hours?trainerId=6a463ee45acf0ed0d5776626&date=2026-09-07';
const headers = { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNGY0ZmRhYWU2MzM4MjVkZmE5YzBlMyIsInN2IjoxLCJhdiI6IjIuMC4xIiwiaWF0IjoxNzg5MDI4NTEyLCJleHAiOjE3ODk2MzMzMTJ9.zNY16CfX6JnlfWiNnsKstMbVuDJ8ulW_qCU1a3DmnSo' };

(async () => {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log(text);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
