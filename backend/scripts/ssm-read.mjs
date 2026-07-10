import { execSync } from 'child_process';

const cmdId = process.argv[2];
const instanceId = process.argv[3] || 'i-0c1d0870a388d973f';
if (!cmdId) {
  console.error('Usage: node ssm-read.mjs <command-id> [instance-id]');
  process.exit(1);
}

const env = { ...process.env, PYTHONIOENCODING: 'utf-8', AWS_PAGER: '' };

const statusRaw = execSync(
  `aws ssm get-command-invocation --command-id ${cmdId} --instance-id ${instanceId} --region ap-south-1 --query Status --output text`,
  { encoding: 'utf8', env }
);
console.log('Status:', statusRaw.trim());

if (statusRaw.trim() === 'Success' || statusRaw.trim() === 'Failed') {
  try {
    const out = execSync(
      `aws ssm get-command-invocation --command-id ${cmdId} --instance-id ${instanceId} --region ap-south-1 --query StandardOutputContent --output text`,
      { encoding: 'utf8', env }
    );
    console.log(out.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ''));
  } catch (e) {
    console.log('(output contains non-ASCII, partial read failed)');
  }
}
