import { execSync } from 'child_process';

const env = { ...process.env, PYTHONIOENCODING: 'utf-8', AWS_PAGER: '' };
const paramsFile = process.argv[2] || '../whatsapp-bridge/scripts/ssm-bridge-check.json';
const instanceId = process.argv[3] || 'i-0c1d0870a388d973f';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cmdId = execSync(
  `aws ssm send-command --instance-ids ${instanceId} --document-name AWS-RunShellScript --parameters file://${paramsFile} --region ap-south-1 --query Command.CommandId --output text`,
  { encoding: 'utf8', env }
).trim();

for (let i = 0; i < 90; i += 1) {
  const status = execSync(
    `aws ssm get-command-invocation --command-id ${cmdId} --instance-id ${instanceId} --region ap-south-1 --query Status --output text`,
    { encoding: 'utf8', env }
  ).trim();
  if (status === 'Success' || status === 'Failed' || status === 'Cancelled' || status === 'TimedOut') {
    try {
      const out = execSync(
        `aws ssm get-command-invocation --command-id ${cmdId} --instance-id ${instanceId} --region ap-south-1 --query StandardOutputContent --output text`,
        { encoding: 'utf8', env }
      );
      console.log('Status:', status);
      console.log(String(out).replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ''));
    } catch (error) {
      console.log('Status:', status);
      console.log('Could not read StandardOutputContent (encoding). Trying ASCII via SSM echo fallback.');
    }
    process.exit(status === 'Success' ? 0 : 1);
  }
  await sleep(2000);
}
console.log('Timed out waiting for SSM command', cmdId);
process.exit(1);
