import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, '../../whatsapp-bridge/index.js');
const b64 = fs.readFileSync(indexPath).toString('base64');

const commands = [
  `echo '${b64}' | base64 -d > /opt/MBUTOMS/whatsapp-bridge/index.js`,
  "grep -n 'Ignored non-media' /opt/MBUTOMS/whatsapp-bridge/index.js | head -1 | tr -cd '\\11\\12\\15\\40-\\176'",
  "sudo pkill -9 -f 'wwebjs_auth/session' || true",
  "sleep 2",
  "sudo su - ubuntu -c 'cd /opt/MBUTOMS/whatsapp-bridge && pm2 restart mbutoms-whatsapp-bridge'",
  "sleep 20",
  "tail -6 /home/ubuntu/.pm2/logs/mbutoms-whatsapp-bridge-out.log | tr -cd '\\11\\12\\15\\40-\\176'",
];

const outPath = path.resolve(__dirname, '../../whatsapp-bridge/scripts/ssm-deploy-index.json');
fs.writeFileSync(outPath, JSON.stringify({ commands }, null, 2));
console.log('Wrote', outPath, 'commands:', commands.length, 'b64 bytes:', b64.length);
