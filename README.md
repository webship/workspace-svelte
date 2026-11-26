<p align="center"><img src="https://raw.githubusercontent.com/webship/workspace-svelte/1.0.x/assets/logo.svg" alt="Svelte logo" width="96"></p>

# @webship.co/workspace-svelte

Svelte for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder that makes a SvelteKit
app with the official create flow (or takes one from its repository), builds it with the Node adapter and serves it
from a container of its own, the [Svelte step pack](https://github.com/webship/svelte-steps) wired into the testing
setup of that app, and its AI items — two agents, a skill, a command and two prompts for building and testing SvelteKit
apps — each listed in the workspace folder of its kind.

The app brings its own language in its own container. Node.js runs in the app's container, at the version of the
workspace rule (24); the app is made there with the create tool of the Svelte project (`sv create`, pinned to 1.7.1),
built there with the Node adapter, and served by the adapter's own server (`node build`). Nothing of Node.js, npm or
the create tool runs on the machine. The app is the demo of the create tool, its minimal template, or an app of your
own from its repository.

The workspace is container-based (DDEV by default): an app is a row like any other, so the row menus the core draws
(start, stop, launch, backup, clone, remove, tests) work on it; what does not apply to an app without a database is
listed under [What is different from a platform](#what-is-different-from-a-platform). The builder builds on DDEV by
default, and with `--runtime` on Docker Compose, Podman or a Kubernetes cluster: see [Runtimes](#runtimes).

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require svelte --with-needs     # npm install into the dashboard
bash core/scripts/plugins.sh --activate svelte --with-needs    # plugins.svelte in settings.yml
bash core/scripts/plugins.sh --install svelte                  # the builder, functions, args, AI items
bash core/scripts/plugins.sh --configure svelte                # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is idempotent.
`--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-svelte-project.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The agents `svelte-app-builder`, `svelte-tester` | `ai-agents/` |
| The skill `svelte-scenarios` | `ai-skills/` |
| The command `/svelte-test` | `ai-commands/` |
| The prompts `svelte-build-and-test`, `svelte-scenarios-for-an-app` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompts are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is
missing first:

```bash
bash core/scripts/plugins.sh --activate svelte --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install svelte
```

Everything the builder runs for an app runs in the app's own container, through the container tool the workspace
already needs; the plugin asks for no command of its own on the machine. Making an app downloads the create tool and
the app's packages from the npm registry, in the container.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-svelte-project.sh` | The builder, in the Build list as **Svelte (SvelteKit app)**, installed into every sites folder |
| `scripts/functions/fun-svelte.sh` | The bash functions behind it, sourced by bootstrap once installed; the names the core's tools look for (`set_svelte_users`, `add_svelte_users`, `cancel_svelte_users`, `testing_configure_svelte`) |
| `scripts/args/arg-svelte.sh` | Its argparse; the Build form draws the builder's flags from it |
| `testing/site.feature` | The first feature the demo gets when testing is set up |
| `ai/agents/svelte-app-builder.md` | The agent that builds and fixes apps: the build in the container, the address forms are checked against, names a person reads |
| `ai/agents/svelte-tester.md` | The agent that writes and runs scenarios with the step pack, with JavaScript and without |
| `ai/skills/svelte-scenarios/` | The skill: the step pack's phrases, the traps found on a real app, three example features |
| `ai/commands/svelte-test.md` | The slash command `/svelte-test <app>`: set up when missing, match every step, run, report |
| `ai/prompts/svelte-build-and-test.md`, `svelte-scenarios-for-an-app.md` | Two prompts: whole launch commands for a new session |
| `src/index.ts` | `register(api)`: what the assistant is told about Svelte here |
| `features/svelte.feature`, `features/svelte-runtimes.feature` | Scenarios for the dashboard's own browser suite |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## What is different from a platform

| | WordPress (a platform) | Svelte |
| --- | --- | --- |
| What is built | A WordPress site | A SvelteKit app: the demo or the minimal template of `sv create`, or an app from its repository, built with the Node adapter |
| Project | `--project-type=wordpress` | `--project-type=generic --webserver-type=generic`, no database: the app's own server serves it |
| The language | PHP, in the container tool's image | Node.js 24 in the app's container: DDEV's web container (`--nodejs-version`) on DDEV; on Docker Compose, Podman and Kubernetes the core's language stack (`rt_stack node 24`, Node.js's own image, and `rt_serve`) |
| Recognised by | The project type | On DDEV a file the builder writes, `.ddev/config.svelte.yaml` (it also records where the app came from); on another runtime its claim, `platform: svelte` in the `x-webship` block of `compose.yaml` |
| Accounts | WP-CLI | None of the workspace's: `--add-users` is taken and adds nothing |
| Testing | The WordPress pack | The Svelte pack, which waits for the app to take each page over and sends a form the way the app does |

## The commands

Run it from a sites folder. `--help` is safe.

### Build and serve an app

```bash
cd ~/workspace/dev
bash cmd-svelte-project.sh skapp --install                      # a new app: the demo of the create tool
bash cmd-svelte-project.sh skmin --install --template minimal   # the minimal template: one page
bash cmd-svelte-project.sh skown --install --source https://github.com/<you>/<app>.git --ref main
bash cmd-svelte-project.sh skapp --install --runtime docker     # on Docker Compose instead of DDEV
bash cmd-svelte-project.sh skapp --install --runtime kubernetes # on the workspace's Kubernetes cluster
```

| Flag | What it does |
| --- | --- |
| `--install` | Serve the built app and check that it answers at its address (`https://<name>.ddev.site` on DDEV) |
| `--runtime ddev\|docker\|podman\|kubernetes` | The container runtime to build on (default: DDEV, or `container.runtime` of `settings.yml`); see [Runtimes](#runtimes) |
| `--template demo\|minimal` | The template of the create tool a new app is made from (default: `demo`: a counter, an about page and a word game of form actions) |
| `--source <git url>` | A repository of a SvelteKit app, instead of a new one |
| `--ref <branch or tag>` | A branch or a tag of that repository (default: its default branch) |
| `--path <folder>` | The folder of the app in that repository, for a repository of several apps |
| `--add-users` | Taken so that every builder accepts the same flags; the app has no accounts of the workspace's |
| `--launch` | Open the app in a browser when it is ready |

The builder deletes a project of the same name first, then makes a container with Node.js, makes the app in it with
`sv create --template <demo|minimal> --types ts --add sveltekit-adapter=adapter:node` (or copies it from its
repository), builds it with `npm run build`, and with `--install` checks that its server answers.

An app of your own must be a SvelteKit app whose packages are its own:

- **Its package manager** is read from its lock file: npm (`package-lock.json`, or none), pnpm or yarn, the last two
  through Node.js's corepack. One installed with Bun is refused, with a message.
- **Its adapter:** one built with another adapter is switched to the Node adapter with the create tool's own add-on
  (`sv add sveltekit-adapter=adapter:node`), at the adapter's release line for the app's SvelteKit (5.x for SvelteKit
  2, 6.x for SvelteKit 3), and the build says so: the app serves itself.
- **Refused, with a message:** an app that takes packages of a workspace of its repository (`"workspace:"` in its
  `package.json`), and one that is not a SvelteKit app.

The project's folder holds the app's source in `app/` and the built server in `app/build/`. After a change to the
app, build it again in the container and restart the project, so its server loads the new build:

```bash
cd ~/workspace/dev/skapp
ddev exec -d /var/www/html/app "npm run build"
ddev restart
```

### The address forms are checked against

The app refuses a form whose origin is not its own address (its check against cross-site forms: 403 "Cross-site POST
form submissions are forbidden"), and the Node adapter cannot tell that address behind a proxy or on a plain port.
The builder gives the app's server the project's address, as the runtime says it (`ORIGIN`): `https://<name>.ddev.site`
on DDEV, the address the build prints elsewhere. Open the app at that address.

### Test an app

```bash
bash cmd-tools-testing.sh skapp                                  # webship-js, the step pack, a first feature
bash cmd-tools-testing.sh skapp --run --path tests/features/site.feature
```

The testing setup adds `@webship-js/svelte-steps` to the project, lists its step definitions in `cucumber.js`, takes
`--disable-web-security` out of the browser's arguments in `playwright.config.ts` (a browser started with it sends a
form without its `Origin` header, and the app refuses every form with 403; it says so in one line when it does), and,
for the demo of the create tool, writes `tests/features/site.feature`. An app of your own gets no first feature: it
has its own names. It changes nothing in a project that is not an app of this builder.

The steps wait for the app to take each page over, follow a navigation inside the app to its end (the address, the new
page's title announced to screen readers, the page at rest), and send a form either way: inside the page with
JavaScript, with a page load without it.

```gherkin
Feature: The word game
  Scenario: A word the game does not know is refused
    Given I am on "/sverdle"
    When I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "enter" button
    Then the app should have refused the form
```

### Runtimes

The commands are the same on every runtime: the builder speaks DDEV's verbs, and on another runtime the core's layer
(Webship Workspace 1.0.32 or later, webship/workspace#694 and #841) gives each verb its meaning there: the language
stack builds the web image from Node.js's own image at version 24 and starts the app's server in it. The app has no
database, so on Kubernetes it needs core 1.0.35 or newer (webship/workspace#884).

| Runtime | The address of the app | Proven with this builder |
| --- | --- | --- |
| DDEV (the default) | `https://<name>.ddev.site` | The demo built and served in 2 minutes (Node.js 24 in DDEV's web container: the create tool, its packages and the build); in a browser the app takes the page over in about 100 ms, and a guess of the word game is posted and answered with the page's own Origin; the testing setup from npm (`@webship-js/svelte-steps` 2.0.0, webship-js 2.0.18) and its first feature, 5 scenarios and 26 steps |
| Docker Compose (`--runtime docker`) | `http://127.0.0.1:<port>`, a free port kept in `compose.yaml` | The demo (`ci-svelte`, the CI's featuresSite) built in 2 min 17 s, its files the host user's, taken over in 74 ms, a guess answered; the minimal template in 1 min 22 s; the RealWorld app of the Svelte project from its repository (SvelteKit 2, pnpm, another adapter) in 1 min 4 s, switched to the Node adapter's 5.x; the testing setup and its first feature (5 scenarios, 26 steps), and the skill's three examples, each on its app: the demo's pages and navigation (5 scenarios, 28 steps) and its word game (2 scenarios, 18 steps), the minimal template (2 scenarios, 7 steps); the plugin's features on the dashboard |
| Podman (`--runtime podman`) | `http://127.0.0.1:<port>` | The demo built in 1 min 55 s with Node.js's own image, served, its files the host user's; taken over in 68 ms, a guess answered; the plugin's features on the dashboard |
| Kubernetes (`--runtime kubernetes`) | `http://<node address>:<NodePort>` | On kind (Kubernetes 1.37.0): the demo built in 1 min 56 s, served at the node's address, taken over in 65 ms, a guess answered with the node's address as its Origin; the plugin's features on the dashboard, 12 scenarios with the Docker Compose, Podman and Kubernetes apps up |

A project of the builder is known by DDEV's file on DDEV and by its claim on another runtime, so the testing setup,
the Users tools (which say there are no accounts) and the dashboard's row work the same on each. Lando and Docksal are
runtimes of the workspace too, not proven with this builder yet: it says so and stops, before anything is made.

### Users

The app has no accounts of the workspace's. `cmd-tools-add-users.sh <name> svelte` and
`cmd-tools-cancel-users.sh <name> svelte` say so and change nothing.

## The AI items

| Item | Kind | What it is for |
| --- | --- | --- |
| `svelte-app-builder` | agent | Builds and fixes SvelteKit apps in their container: the build, the address forms are checked against, names a person reads |
| `svelte-tester` | agent | Writes and runs scenarios with the step pack: looks at the pages in the browser first, never sleeps, never names a framework or platform in a step, runs with JavaScript and without |
| `svelte-scenarios` | skill | The step pack's phrases, the traps found on a real app, three example features that pass on the demo and on the minimal template |
| `/svelte-test <app>` | command | Sets the pack up when missing, matches every step, runs, reports |
| `svelte-build-and-test` | prompt | Builds an app and proves it with its first feature |
| `svelte-scenarios-for-an-app` | prompt | Writes and runs the scenarios of one page of an app of the workspace |

Every item says the workspace is container-based (DDEV by default), and the agents and the skill send the reader to
the book *Automated Functional Testing Recipes* first.

## Develop it

```bash
npm install
npm test        # builds, then the unit tests: the manifest, the scripts, the AI items, the needs
npm run lint    # the TypeScript compiler, no output
```

CI runs the same on Node.js 24 and 26, checks that every shell script parses, and runs the plugin's webship-js
features against a dashboard with the plugin installed (the reusable workflow
`webship/workspace/.github/workflows/plugin-browser-suite.yml`). Before the features it builds the app the manifest
names (`featuresSite`: `cmd-svelte-project.sh ci-svelte --install --runtime docker`), so the scenarios of
`features/svelte-runtimes.feature` tagged `@needs-runtime-docker` drive a real app on Docker Compose; the Podman and
Kubernetes ones run where such an app is.
`tests/fixtures/step-definitions.txt` holds the step definitions of the step pack at the version the testing hook pins
and of webship-js, read from their packages: every phrase an AI item shows must match one of them.

## License

ISC (see `LICENSE`).

## Logo

The Svelte logo in this README comes from Simple Icons 16.37.0, filled with the colour the set lists for the brand;
the set is CC0-1.0 and takes the mark from Svelte's branding repository (https://github.com/sveltejs/branding). The
Svelte name and logo are trademarks of their owner; this plugin is not affiliated with or endorsed by them.
