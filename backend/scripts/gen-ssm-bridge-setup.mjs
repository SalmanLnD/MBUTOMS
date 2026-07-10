import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const bridgeDir = path.join(repoRoot, 'whatsapp-bridge');

const encode = (filePath) => fs.readFileSync(filePath).toString('base64');

const envB64 = encode(path.join(bridgeDir, '.env'));
const indexB64 = encode(path.join(bridgeDir, 'index.js'));

const commands = [
  'set -e',
  'test -d /opt/MBUTOMS/whatsapp-bridge',
  `echo '${envB64}' | base64 -d > /opt/MBUTOMS/whatsapp-bridge/.env`,
  `echo '${indexB64}' | base64 -d > /opt/MBUTOMS/whatsapp-bridge/index.js`,
  'chown ubuntu:ubuntu /opt/MBUTOMS/whatsapp-bridge/.env /opt/MBUTOMS/whatsapp-bridge/index.js',
  'sudo -u ubuntu bash -lc "cd /opt/MBUTOMS/whatsapp-bridge && npm install"',
  'sudo -u ubuntu bash -lc "cd /opt/MBUTOMS/whatsapp-bridge && npx puppeteer browsers install chrome"',
  'sudo -u ubuntu bash -lc "pm2 delete all 2>/dev/null || true"',
  'sudo pkill -9 -f "/opt/MBUTOMS/whatsapp-bridge/index.js" || true',
  'sudo pkill -9 -f "wwebjs_auth" || true',
  'sudo pkill -9 -f "chrome" || true',
  'rm -f /opt/MBUTOMS/whatsapp-bridge/.bridge-instance.lock',
  'sudo -u ubuntu bash -lc "cd /opt/MBUTOMS/whatsapp-bridge && pm2 start index.js --name mbutoms-whatsapp-bridge"',
  'sudo -u ubuntu bash -lc "pm2 save"',
  'sleep 15',
  'sudo -u ubuntu bash -lc "pm2 status"',
  'printf "\\n--- bridge log ---\\n"',
  'python3 - <<\'PY\'\nfrom pathlib import Path\np = Path("/home/ubuntu/.pm2/logs/mbutoms-whatsapp-bridge-out.log")\nif p.exists():\n    lines = p.read_text(errors="ignore").splitlines()[-20:]\n    print("\\n".join(lines))\nPY',
];

const outPath = path.join(bridgeDir, 'scripts', 'ssm-bridge-setup.json');
fs.writeFileSync(outPath, JSON.stringify({ commands }, null, 2));
console.log(outPath);
