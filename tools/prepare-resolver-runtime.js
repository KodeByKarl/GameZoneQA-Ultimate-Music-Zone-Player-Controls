const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');

const PYTHON_VERSION = '3.11.9';
const PYTHON_ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';
const PLAYWRIGHT_VERSION = '1.47.0';

const rootDir = path.resolve(__dirname, '..');
const cacheDir = path.join(rootDir, 'tools', '.cache');
const pythonDir = path.join(rootDir, 'binaries', 'win', 'python');
const pythonExe = path.join(pythonDir, 'python.exe');
const browserDir = path.join(rootDir, 'script', 'browsers');

function log(message) {
  console.log(`[resolver-runtime] ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

function runQuiet(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    windowsHide: true,
    ...options,
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
  return result.status === 0;
}

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
        response.resume();
        if (redirects > 5) {
          reject(new Error(`Too many redirects while downloading ${url}`));
          return;
        }
        const nextUrl = new URL(response.headers.location, url).toString();
        download(nextUrl, destination, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed ${response.statusCode}: ${url}`));
        return;
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function ensureDownloaded(url, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) return;
  log(`Downloading ${path.basename(destination)}...`);
  await download(url, destination);
}

function enableSitePackages() {
  const pthFile = fs.readdirSync(pythonDir).find((name) => /^python\d+._pth$/i.test(name));
  if (!pthFile) return;
  const fullPath = path.join(pythonDir, pthFile);
  let content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('#import site')) content = content.replace('#import site', 'import site');
  if (!content.includes('import site')) content += '\r\nimport site\r\n';
  fs.writeFileSync(fullPath, content);
}

async function ensurePython() {
  if (fs.existsSync(pythonExe)) {
    enableSitePackages();
    return;
  }

  await fsp.mkdir(pythonDir, { recursive: true });
  const zipPath = path.join(cacheDir, `python-${PYTHON_VERSION}-embed-amd64.zip`);
  await ensureDownloaded(PYTHON_ZIP_URL, zipPath);

  log('Extracting embedded Python...');
  new AdmZip(zipPath).extractAllTo(pythonDir, true);
  enableSitePackages();

  const getPipPath = path.join(cacheDir, 'get-pip.py');
  await ensureDownloaded(GET_PIP_URL, getPipPath);
  log('Installing pip into embedded Python...');
  run(pythonExe, [getPipPath, '--no-warn-script-location']);
}

function hasPlaywrightPackage() {
  return runQuiet(pythonExe, ['-c', 'import playwright; import playwright.sync_api']);
}

function hasChromiumBrowser() {
  if (!fs.existsSync(browserDir)) return false;
  const stack = [browserDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile() && entry.name.toLowerCase() === 'chrome.exe' && fullPath.toLowerCase().includes('chrom')) {
        return true;
      }
    }
  }
  return false;
}

async function ensurePlaywright() {
  await fsp.mkdir(browserDir, { recursive: true });

  if (!hasPlaywrightPackage()) {
    log(`Installing Python Playwright ${PLAYWRIGHT_VERSION}...`);
    run(pythonExe, [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--no-warn-script-location',
      `playwright==${PLAYWRIGHT_VERSION}`
    ]);
  }

  if (!hasChromiumBrowser()) {
    log('Installing bundled Playwright Chromium...');
    run(pythonExe, ['-m', 'playwright', 'install', 'chromium'], {
      env: {
        PLAYWRIGHT_BROWSERS_PATH: browserDir
      }
    });
  }
}

async function main() {
  await ensurePython();
  await ensurePlaywright();
  run(pythonExe, ['-c', 'from playwright.sync_api import sync_playwright; print("resolver runtime ok")'], {
    env: {
      PLAYWRIGHT_BROWSERS_PATH: browserDir
    }
  });
  log('Ready.');
}

main().catch((error) => {
  console.error(`[resolver-runtime] ${error.stack || error.message || error}`);
  process.exit(1);
});
