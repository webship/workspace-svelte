import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-svelte.sh');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

// The playwright.config.ts webship-js 2.0.17 and older scaffold, as far as the testing hook reads it.
const PLAYWRIGHT = `const chromiumArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--ignore-certificate-errors',
];
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(kind: 'demo' | 'own' | 'drupal') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-plugin-'));
  const dir = path.join(root, 'dev', 'app1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: app1\ntype: ${kind === 'drupal' ? 'drupal11' : 'generic'}\n`);
  if (kind !== 'drupal') {
    fs.writeFileSync(path.join(dir, '.ddev', 'config.svelte.yaml'), '# A SvelteKit app in this project.\n');
    fs.mkdirSync(path.join(dir, 'app', 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app', 'src', 'routes', '+page.svelte'), '<h1>Welcome</h1>\n');
    if (kind === 'demo') {
      fs.mkdirSync(path.join(dir, 'app', 'src', 'routes', 'sverdle'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'app', 'src', 'routes', 'sverdle', '+page.svelte'), '<h1>Sverdle</h1>\n');
    }
  }
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), PLAYWRIGHT);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app1', devDependencies: { 'webship-js': '^2.0.16' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'svelte'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'svelte', 'site.feature'));
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder. */
function bash(script: string, env: Record<string, string> = {}) {
  const fake = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; return 0 ; }';
  return spawnSync('bash', ['-c', `${fake}\nsource ${FUNCTIONS}\n${script}`], { encoding: 'utf8', env: { ...process.env, ...env } });
}

test('the app has no accounts of the workspace: the list is empty, and adding or removing them says so', () => {
  let r = bash('set_svelte_users ; echo "${#users[@]}"');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), '0');
  r = bash('add_svelte_users ; cancel_svelte_users');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /no accounts of the workspace's, so there are none to add/);
  assert.match(r.stdout, /no accounts of the workspace's, so there are none to remove/);
});

const hook = (p: { dir: string; root: string; scripts: string }) =>
  bash(`cd ${p.dir} && testing_configure_svelte ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1' });

test('the testing hook adds the step pack, takes the web-security flag out, and for the demo writes a first feature, once', () => {
  const p = project('demo');
  const r = hook(p);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/svelte-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.16', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/svelte-steps/tests/step-definitions/*.js',", 'the pack is listed right after webship-js');
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; console.log(JSON.stringify([c.require.length, c.paths]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  assert.deepStrictEqual(JSON.parse(loaded.stdout), [3, ['tests/features/**/*.feature']]);
  // The browser keeps its web security: with the flag it sends a form without its Origin, and the app refuses it.
  const config = fs.readFileSync(path.join(p.dir, 'playwright.config.ts'), 'utf8');
  assert.doesNotMatch(config, /disable-web-security/);
  assert.strictEqual(config, PLAYWRIGHT.replace("  '--disable-web-security',\n", ''), 'only that line goes');
  assert.match(r.stdout, /playwright\.config\.ts: --disable-web-security taken out of the browser's arguments: with it the browser sends a form without its Origin header, and the app refuses every form with 403/);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), read('testing/site.feature'));
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  const again = hook(p);
  assert.strictEqual(again.status, 0);
  assert.doesNotMatch(again.stdout, /package\.json:|cucumber\.js:|playwright\.config\.ts:|tests\/features\/site\.feature:/, 'a second run adds nothing');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('a config that never had the flag, or names it only in a comment, is left as it is', () => {
  const p = project('demo');
  const kept = "// No --disable-web-security: the browser keeps the same-origin policy.\nconst chromiumArgs: string[] = [\n  '--no-sandbox',\n];\n";
  fs.writeFileSync(path.join(p.dir, 'playwright.config.ts'), kept);
  const r = hook(p);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'playwright.config.ts'), 'utf8'), kept);
  assert.doesNotMatch(r.stdout, /playwright\.config\.ts:/);
});

test('an app of your own gets the step pack, and no first feature: it has its own names', () => {
  const p = project('own');
  const r = hook(p);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), /@webship-js\/svelte-steps\/tests\/step-definitions/);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  assert.match(r.stdout, /the app is not the demo of the create tool, so no first feature is written/);
});

test('the testing hook waits for the testing stack: without cucumber.js it says to run the setup again', () => {
  const p = project('demo');
  fs.rmSync(path.join(p.dir, 'cucumber.js'));
  const r = hook(p);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /cucumber\.js is not here yet/);
});

test('the testing hook leaves any other project alone, its browser flags too', () => {
  const p = project('drupal');
  const r = hook(p);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'playwright.config.ts'), 'utf8'), PLAYWRIGHT);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
});

test('the app\'s server waits for the build, listens on its port and is told the address the browser opens', () => {
  const r = bash('svelte_serve_command https://app1.ddev.site');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), 'while [ ! -f /var/www/html/app/build/index.js ]; do sleep 2; done; cd /var/www/html/app && exec env PORT=3000 HOST=0.0.0.0 ORIGIN=https://app1.ddev.site node build');
  assert.doesNotMatch(r.stdout, / ;/, 'no " ;", which starts a comment in the supervisor configuration DDEV writes from it');
});

test('on DDEV the router sends the address to the app\'s server, a daemon that waits for the build', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-ddev-'));
  const r = bash(`svelte_write_ddev_config ${root} 'the demo template of sv 1.7.1' https://app1.ddev.site`);
  assert.strictEqual(r.status, 0, r.stderr);
  const yaml = fs.readFileSync(path.join(root, '.ddev', 'config.svelte.yaml'), 'utf8');
  assert.match(yaml, /web_extra_exposed_ports:\n  - name: svelte\n    container_port: 3000\n    http_port: 80\n    https_port: 443/);
  assert.match(yaml, /web_extra_daemons:\n  - name: svelte\n    command: "bash -c 'while \[ ! -f \/var\/www\/html\/app\/build\/index\.js \]; do sleep 2; done; cd \/var\/www\/html\/app && exec env PORT=3000 HOST=0\.0\.0\.0 ORIGIN=https:\/\/app1\.ddev\.site node build'"\n    directory: \/var\/www\/html/);
  assert.doesNotMatch(yaml.split('command: ')[1].split('\n')[0], / ;/, 'no " ;" in the daemon\'s command');
  assert.match(yaml, /^# app: the demo template of sv 1\.7\.1$/m);
  assert.ok(!fs.existsSync(path.join(root, '.ddev', 'web-build')), 'the web image is DDEV\'s own: Node.js comes with the project\'s nodejs_version');
});

/** A build of app1 in a fresh workspace folder, with `ddev` and the core's helpers recorded; `layer` stands for the
 * core's runtime layer (fun-runtime.sh), as far as the builder asks it. The recorder makes the files the commands in
 * the container would: the new app, the copied one (its package.json from PKGJSON, its lock file LOCK), the adapter
 * the create tool's add-on adds, the build. */
function build(opts: { layer?: string; env?: Record<string, string> } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-build-'));
  fs.mkdirSync(path.join(root, 'dev'), { recursive: true });
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'svelte'), { recursive: true });
  const log = path.join(root, 'ddev.log');
  const app = path.join(root, 'dev', 'app1', 'app');
  const script = [
    'trim_project_name() { :; } ; drop_database() { :; } ; ddev_up() { ddev "$@" ; } ; ddev_nodejs_version() { echo 24 ; }',
    `ddev() { echo "ddev $*" >> ${log} ; case "$*" in`,
    `  *"create --template demo"*) mkdir -p ${app}/src/routes/sverdle && touch ${app}/src/routes/sverdle/+page.svelte && echo '{"devDependencies":{"@sveltejs/kit":"^3.4.1","@sveltejs/adapter-node":"^6.0.6"}}' > ${app}/package.json ;;`,
    `  *"create --template minimal"*) mkdir -p ${app}/src/routes && echo '{"devDependencies":{"@sveltejs/kit":"^3.4.1","@sveltejs/adapter-node":"^6.0.6"}}' > ${app}/package.json ;;`,
    `  *"cp -a"*) mkdir -p ${app} && printf '%s' "$PKGJSON" > ${app}/package.json && { [ -z "$LOCK" ] || touch ${app}/$LOCK ; } ;;`,
    `  *"add sveltekit-adapter"*) sed -i 's/"@sveltejs\\/kit"/"@sveltejs\\/adapter-node":"^6.0.6","@sveltejs\\/kit"/' ${app}/package.json ;;`,
    `  *" run build"*) mkdir -p ${app}/build && touch ${app}/build/index.js ;;`,
    'esac ; return 0 ; }',
    opts.layer || '',
    'PROJECT_NAME=app1',
    'svelte_build',
  ].join('\n');
  const r = spawnSync('bash', ['-c', `source ${FUNCTIONS}\n${script}`], { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: root, WORKSPACE_SCRIPTS: scripts, doc_name: 'dev', INSTALL: 'yes', PKGJSON: '', LOCK: '', ...(opts.env || {}) } });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  return { r, calls, root, log, project: path.join(root, 'dev', 'app1') };
}

test('a new app: the demo of the create tool, built with the Node adapter in the container, served at the project\'s address', () => {
  const b = build();
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /^ddev config --project-type=generic --webserver-type=generic --docroot= --project-name=app1 --omit-containers=db --nodejs-version=24$/m);
  const yaml = fs.readFileSync(path.join(b.project, '.ddev', 'config.svelte.yaml'), 'utf8');
  assert.match(yaml, /ORIGIN=https:\/\/app1\.ddev\.site node build/, 'the server is told the address the runtime gives');
  assert.match(b.calls, /^ddev start -y$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html npx --yes sv@1\.7\.1 create --template demo --types ts --add sveltekit-adapter='adapter:node' --install npm --no-dir-check app$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npm run build$/m);
  assert.ok(b.calls.indexOf('ddev start') < b.calls.indexOf('sv@1.7.1 create'), 'the app is made in the container, once it runs');
  assert.match(b.calls, /curl -sS -o \/dev\/null http:\/\/127\.0\.0\.1:3000\//, '--install waits for the app\'s server');
  assert.match(b.r.stdout, /^Go to https:\/\/app1\.ddev\.site$/m);
  assert.match(b.r.stdout, /dev app1 is served: the SvelteKit app in app\/ \(the demo template of sv 1\.7\.1\), built with the Node adapter\./);
  assert.doesNotMatch(b.calls, /^ddev stop/m, 'with --install the app stays served');
  assert.doesNotMatch(b.calls, /git clone|sv@1\.7\.1 add/, 'nothing is cloned, and the adapter is the create tool\'s own');
});

test('without --install the app is built and the project stopped; --template minimal makes the one-page app', () => {
  const b = build({ env: { INSTALL: '', TEMPLATE: 'minimal' } });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /sv@1\.7\.1 create --template minimal --types ts --add sveltekit-adapter='adapter:node' --install npm --no-dir-check app$/m);
  assert.match(b.calls, /^ddev stop$/m, 'ddev stop takes no -y');
  assert.match(b.r.stdout, /dev app1 is ready: the SvelteKit app in app\/ \(the minimal template of sv 1\.7\.1\), built with the Node adapter\./);
  assert.match(b.r.stdout, /Serve it with: cd app1 && ddev start/);
});

const KIT = '{"name":"own","scripts":{"build":"vite build"},"devDependencies":{"@sveltejs/kit":"^3.4.1","@sveltejs/adapter-auto":"^9.0.0"}}';
const KIT_NODE = '{"name":"own","devDependencies":{"@sveltejs/kit":"^3.4.1","@sveltejs/adapter-node":"^6.0.6"}}';
const KIT2 = '{"name":"realworld","scripts":{"build":"vite build"},"devDependencies":{"@sveltejs/kit":"^2.52.2","@sveltejs/adapter-vercel":"^6.3.2"}}';

test('an app from a repository: its folder copied out, switched to the Node adapter when it has another, installed and built with its own package manager', () => {
  let b = build({ env: { SOURCE: 'https://example.com/apps.git', REF: 'main', APP_PATH: 'web', PKGJSON: KIT } });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /git clone --quiet --depth 1 --branch 'main' 'https:\/\/example\.com\/apps\.git' \/tmp\/svelte-source/);
  assert.match(b.calls, /test -f '\/tmp\/svelte-source\/web\/package\.json' && mkdir -p \/var\/www\/html\/app && cp -a '\/tmp\/svelte-source\/web\/\.' \/var\/www\/html\/app\/ && rm -rf \/var\/www\/html\/app\/\.git/);
  assert.doesNotMatch(b.calls, /sv@1\.7\.1 create/, 'no new app is made');
  assert.match(b.r.stdout, /The app builds with another adapter: switching it to the Node adapter \(sv add sveltekit-adapter=adapter:node\), so it serves itself\./);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npx --yes sv@1\.7\.1 add sveltekit-adapter='adapter:node' --no-git-check --no-install$/m);
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npm install$/m);
  assert.ok(b.calls.indexOf(' add sveltekit-adapter') < b.calls.indexOf('npm install'), 'the adapter is added before the packages are installed');
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app npm run build$/m);
  assert.match(fs.readFileSync(path.join(b.project, '.ddev', 'config.svelte.yaml'), 'utf8'), /^# app: https:\/\/example\.com\/apps\.git \(main\), web\/$/m);
  // pnpm and yarn come through corepack, without its prompt; an app with the Node adapter keeps its own setup.
  for (const [lock, pm] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn']]) {
    b = build({ env: { SOURCE: 'https://example.com/app.git', PKGJSON: KIT_NODE, LOCK: lock } });
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.match(b.calls, new RegExp(`^ddev exec -d /var/www/html/app COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack ${pm} install$`, 'm'));
    assert.match(b.calls, new RegExp(`^ddev exec -d /var/www/html/app COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack ${pm} run build$`, 'm'));
    assert.doesNotMatch(b.calls, /add sveltekit-adapter/, 'an app with the Node adapter is left as it is');
  }
});

test('an app on SvelteKit 2 gets the Node adapter of its release line, not the latest (SvelteKit 3\'s)', () => {
  const b = build({ env: { SOURCE: 'https://example.com/realworld.git', PKGJSON: KIT2, LOCK: 'pnpm-lock.yaml' } });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.match(b.calls, /add sveltekit-adapter='adapter:node' --no-git-check --no-install$/m);
  assert.match(b.r.stdout, /The app is on SvelteKit 2 \(\^2\.52\.2\): the Node adapter of its release line, @sveltejs\/adapter-node \^5\.0\.0\./);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(b.project, 'app', 'package.json'), 'utf8')).devDependencies['@sveltejs/adapter-node'], '^5.0.0');
  assert.match(b.calls, /^ddev exec -d \/var\/www\/html\/app COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install$/m, 'and installs it with the app\'s own package manager');
});

test('the Node adapter is matched to the SvelteKit of the app, and left alone when its major is right or the SvelteKit unknown', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-adapter-'));
  const adapterFor = (kit: string, adapter = '^6.0.6') => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: { '@sveltejs/adapter-node': adapter, '@sveltejs/kit': kit } }));
    const r = bash(`svelte_match_adapter ${dir}`);
    assert.strictEqual(r.status, 0, r.stderr);
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).devDependencies['@sveltejs/adapter-node'];
  };
  assert.strictEqual(adapterFor('^2.52.2'), '^5.0.0');
  assert.strictEqual(adapterFor('~1.30.0'), '^1.0.0');
  assert.strictEqual(adapterFor('^3.4.1'), '^6.0.6', 'an adapter of the right major is left as it is');
  assert.strictEqual(adapterFor('^2.52.2', '^5.5.8'), '^5.5.8');
  assert.strictEqual(adapterFor('next'), '^6.0.6', 'a SvelteKit without a major version leaves the adapter alone');
  assert.strictEqual(adapterFor('^9.0.0'), '^6.0.6', 'and so does a SvelteKit the table does not know');
});

test('an app that is not a SvelteKit app, takes packages of its repository\'s workspace, or needs Bun stops the build with a message', () => {
  for (const [env, message] of [
    [{ PKGJSON: '{"devDependencies":{"svelte":"^5.0.0","vite":"^8.0.0"}}' }, /is not a SvelteKit app \(its package\.json does not list @sveltejs\/kit\)/],
    [{ PKGJSON: '{"dependencies":{"ui":"workspace:*"},"devDependencies":{"@sveltejs/kit":"^3.4.1"}}' }, /takes packages of a workspace of its repository/],
    [{ PKGJSON: KIT_NODE, LOCK: 'bun.lock' }, /installed with Bun \(its lock file\), which is not in the app's container/],
  ] as Array<[Record<string, string>, RegExp]>) {
    const b = build({ env: { SOURCE: 'https://example.com/app.git', ...env } });
    assert.strictEqual(b.r.status, 1, JSON.stringify(env));
    assert.match(b.r.stdout, message);
    assert.doesNotMatch(b.calls, / install$| run build$/m, 'nothing is installed or built');
  }
});

test('--template with --source, an unknown template, --path without --source, a path out of the repository, or a bad project name stop the build before anything is made', () => {
  for (const [env, message] of [
    [{ TEMPLATE: 'minimal', SOURCE: 'https://example.com/app.git' }, /--template makes a new app, and --source takes an app of your own: give one of them\./],
    [{ TEMPLATE: 'library' }, /--template takes demo or minimal/],
    [{ APP_PATH: 'web' }, /--path names a folder of the repository given with --source: give --source too\./],
    [{ SOURCE: 'https://example.com/app.git', APP_PATH: '../etc' }, /take a repository, a branch or tag, and a folder inside the repository/],
    [{ SOURCE: "https://example.com/app.git'; rm -rf /" }, /take a repository, a branch or tag, and a folder inside the repository/],
  ] as Array<[Record<string, string>, RegExp]>) {
    const b = build({ env });
    assert.strictEqual(b.r.status, 1, JSON.stringify(env));
    assert.match(b.r.stdout, message);
    assert.strictEqual(b.calls, '', 'no ddev command ran');
    assert.ok(!fs.existsSync(b.project), 'no project folder was made');
  }
  const b = spawnSync('bash', ['-c', `source ${FUNCTIONS}\ntrim_project_name() { :; } ; ddev() { echo ran ; } ; PROJECT_NAME=App_1 ; svelte_build`], { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: os.tmpdir(), doc_name: 'dev' } });
  assert.strictEqual(b.status, 1);
  assert.match(b.stdout, /The project name App_1 must be small letters, digits and dashes/);
  assert.doesNotMatch(b.stdout, /^ran$/m);
});

/** The core's runtime layer, as far as the builder asks it: the runtime, the address, the claim, the stack. */
const layer = (rt: string, url: string) => [
  `runtime_of() { echo ${rt} ; }`,
  `rt_url() { echo ${url} ; }`,
  'rt_claim() { echo "rt_claim $*" >> "$WORKSPACE_ROOT/ddev.log" ; }',
  'rt_stack() { echo "rt_stack $*" >> "$WORKSPACE_ROOT/ddev.log" ; }',
  'rt_web_build() { echo "rt_web_build $*" >> "$WORKSPACE_ROOT/ddev.log" ; cat > /dev/null ; }',
  'rt_serve() { echo "rt_serve $1" >> "$WORKSPACE_ROOT/ddev.log" ; printf "%s\\n" "$2" > "$WORKSPACE_ROOT/serve.txt" ; }',
].join(' ; ');

test('on DDEV the build runs the same commands with the runtime layer as without it', () => {
  const without = build();
  const withLayer = build({ layer: layer('ddev', 'https://app1.ddev.site') });
  for (const b of [without, withLayer]) {
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.doesNotMatch(b.calls, /rt_claim|rt_stack|rt_serve/, 'the language stack is for the other runtimes');
  }
  assert.strictEqual(withLayer.calls, without.calls, 'the same ddev commands, to the letter');
});

for (const [rt, url] of [['docker', 'http://127.0.0.1:43210'], ['podman', 'http://127.0.0.1:43211'], ['kubernetes', 'http://172.18.0.2:30080']]) {
  test(`on ${rt}: the claim, Node.js's own image at the workspace's version, the app's server told the runtime's address; never a ddev.site`, () => {
    const b = build({ layer: layer(rt, url), env: { RUNTIME: rt } });
    assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
    assert.match(b.calls, /^ddev config --project-type=generic --webserver-type=generic --docroot= --project-name=app1 --omit-containers=db --auto$/m);
    assert.match(b.calls, /^rt_claim svelte$/m);
    assert.match(b.calls, /^rt_stack node 24$/m);
    assert.match(b.calls, /^rt_serve 3000$/m);
    assert.doesNotMatch(b.calls, /rt_web_build/, 'Node.js\'s image and the stack\'s layer carry all the app needs');
    assert.strictEqual(fs.readFileSync(path.join(b.root, 'serve.txt'), 'utf8').trim(), `while [ ! -f /var/www/html/app/build/index.js ]; do sleep 2; done; cd /var/www/html/app && exec env PORT=3000 HOST=0.0.0.0 ORIGIN=${url} node build`);
    assert.ok(!fs.existsSync(path.join(b.project, '.ddev')), 'no .ddev folder: it would make the project a DDEV one');
    assert.ok(b.calls.indexOf('ddev config') < b.calls.indexOf('rt_claim svelte'), 'the claim comes after the runtime\'s files are written');
    assert.match(b.calls, /sv@1\.7\.1 create --template demo/, 'the app is made in the container, as on DDEV');
    assert.match(b.r.stdout, new RegExp(`^Go to ${url.replace(/[.:/]/g, '\\$&')}$`, 'm'));
    assert.doesNotMatch(b.r.stdout, /ddev\.site/, 'no message names a DDEV address');
  });
}

test('--runtime on a core without the runtime layer is refused, and nothing is started', () => {
  const b = build({ env: { RUNTIME: 'docker' } });
  assert.strictEqual(b.r.status, 1);
  assert.match(b.r.stdout, /--runtime docker needs a Webship Workspace with the container runtimes \(webship\/workspace#694\)/);
  assert.strictEqual(b.calls, '', 'no ddev command ran');
  assert.ok(!fs.existsSync(b.project), 'no project folder was made');
});

for (const rt of ['lando', 'docksal']) {
  test(`a runtime this builder is not proven on (${rt}, the workspace's setting) stops the build before anything is made`, () => {
    const b = build({ layer: layer(rt, 'http://127.0.0.1:43212') });
    assert.strictEqual(b.r.status, 1);
    assert.match(b.r.stdout, new RegExp(`builds on DDEV, Docker Compose, Podman and Kubernetes for now \\(--runtime ddev, docker, podman or kubernetes\\), not on ${rt}`));
    assert.strictEqual(b.calls, '', 'no ddev command ran');
    assert.ok(!fs.existsSync(b.project), 'no project folder was made');
  });
}

test('a project of the builder is known by DDEV\'s file, else by the core\'s rt_is_platform', () => {
  let r = bash('rt_is_platform() { echo "asked $*" ; return 0 ; } ; svelte_is_project /x/app1');
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'asked /x/app1 svelte');
  r = bash('rt_is_platform() { return 1 ; } ; svelte_is_project /x/app1');
  assert.strictEqual(r.status, 1);
  const p = project('demo');
  assert.strictEqual(bash(`svelte_is_project ${p.dir}`).status, 0, 'without the layer, .ddev/config.svelte.yaml says so');
  fs.rmSync(path.join(p.dir, '.ddev', 'config.svelte.yaml'));
  assert.strictEqual(bash(`svelte_is_project ${p.dir}`).status, 1);
});

test('the package manager of an app is read from its lock file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-pm-'));
  const pm = () => bash(`svelte_package_manager ${dir}`).stdout.trim();
  assert.strictEqual(pm(), 'npm', 'no lock file: npm');
  for (const [lock, wanted] of [['package-lock.json', 'npm'], ['yarn.lock', 'yarn'], ['pnpm-lock.yaml', 'pnpm'], ['bun.lockb', 'pnpm']]) {
    fs.writeFileSync(path.join(dir, lock), '');
    assert.strictEqual(pm(), wanted, lock);
  }
  assert.strictEqual(bash('svelte_pm npm').stdout.trim(), 'npm');
  assert.strictEqual(bash('svelte_pm pnpm').stdout.trim(), 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm');
});

test('the builder takes the runtimes it is proven on and the create tool\'s templates, and never a flag that would take the name PATH', () => {
  const args = read('scripts/args/arg-svelte.sh');
  assert.match(args, /choices=\['ddev', 'docker', 'podman', 'kubernetes'\]/);
  assert.match(args, /dest='RUNTIME',\n\s+default="_none_"/);
  assert.match(args, /'--template',\n\s+dest='TEMPLATE',\n\s+default="_none_",\n\s+choices=\['demo', 'minimal'\]/);
  assert.match(args, /'--path',\n\s+dest='APP_PATH',/, '--path would otherwise set PATH');
  const src = read('scripts/functions/fun-svelte.sh');
  assert.match(src, /^readonly SVELTE_RUNTIMES='ddev docker podman kubernetes';$/m);
  assert.match(src, /^readonly SVELTE_TEMPLATES='demo minimal';$/m);
});

test('the first feature names no framework or platform in the words of a step', () => {
  const feature = read('testing/site.feature');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s.replace(/"[^"]*"/g, '""'), /svelte|vite|node|drupal|wordpress|joomla/i, s);
});
