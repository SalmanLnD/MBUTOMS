import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const bridgeDir = path.join(scriptDir, '..');

const files = ['index.js', 'ecosystem.config.cjs'];
const commands = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(bridgeDir, file));
  const encoded = content.toString('base64');
  commands.push(`echo '${encoded}' | base64 -d > /opt/MBUTOMS/whatsapp-bridge/${file}`);
}

commands.push(
  "grep -n 'Scheduling reconnect' /opt/MBUTOMS/whatsapp-bridge/index.js | head -1 | tr -cd '\\11\\12\\15\\40-\\176'",
  'sudo pkill -9 -f wwebjs_auth/session || true',
  'sleep 2',
  "sudo -u ubuntu bash -lc 'cd /opt/MBUTOMS/whatsapp-bridge && pm2 delete mbutoms-whatsapp-bridge 2>/dev/null || true'",
  "sudo -u ubuntu bash -lc 'cd /opt/MBUTOMS/whatsapp-bridge && pm2 start ecosystem.config.cjs && pm2 save'",
  'sleep 45',
  "grep -E 'Bridge is ready|Scheduling reconnect|Watchdog|Listening to group' /home/ubuntu/.pm2/logs/mbutoms-whatsapp-bridge-out.log | tail -8 | tr -cd '\\11\\12\\15\\40-\\176'",
  "sudo -u ubuntu bash -lc 'pm2 jlist' | node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d||'[]');const p=j.find(x=>x.name==='mbutoms-whatsapp-bridge');console.log('status='+p?.pm2_env?.status);console.log('restarts='+p?.pm2_env?.restart_time);});\""
);

const outPath = path.join(scriptDir, 'ssm-bridge-deploy-inline.json');
fs.writeFileSync(outPath, JSON.stringify({ commands }));
console.log(`Wrote ${commands.length} commands to ${outPath}`);
