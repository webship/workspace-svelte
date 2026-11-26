/**
 * Svelte for Webship Workspace: a plugin for SvelteKit apps.
 *
 * What the package carries is placed by the installer from the manifest: the builder in the sites
 * folders, its functions, argparse and machine files (a first feature) under core/scripts/plugins/svelte/,
 * its AI items (ai/) in the AI folders. The builder makes a SvelteKit app with the official create flow
 * (or takes one from its repository), builds it with the Node adapter and serves it from a container of
 * its own: Node.js, the app's language, runs in the app's container, never on the machine. The step
 * pack (@webship-js/svelte-steps) goes into the testing setup of such an app with the core's
 * `cmd-tools-testing.sh <project>`. The dashboard needs nothing drawn for it: the builder is in the
 * Build list because it is a cmd-*-project.sh, the row menus are the core's, the AI items are listed
 * like any other. What register() adds is what the assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name, which its functions are named after. */
export const PLATFORM = 'svelte';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-svelte-project.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['svelte-app-builder', 'svelte-tester'];

/** The skill the installer places in the AI Skills folder (a folder each, with its SKILL.md). */
export const SKILLS = ['svelte-scenarios'];

/** The slash command the installer places in the AI Commands folder. */
export const AI_COMMANDS = ['svelte-test'];

/** The prompts the installer places in the AI Prompts folder: whole launch commands for a new session. */
export const PROMPTS = ['svelte-build-and-test', 'svelte-scenarios-for-an-app'];

/** What the assistant is told about Svelte in this workspace. */
export function assistantContext(): string {
  return [
    'Svelte (a plugin, @webship.co/workspace-svelte): its builder makes a SvelteKit app and serves it from a container of its own,',
    'with `bash cmd-svelte-project.sh <name> --install` from a sites folder (dev, test, sandboxes, demos): the app is the demo of',
    'the official create flow (`sv create`, pinned; --template minimal for one page, or a repository of your own with --source,',
    '--ref and --path), built with the Node adapter in the app\'s container, where Node.js runs, and served by the adapter\'s own',
    'server at https://<name>.ddev.site. The app\'s source is in <name>/app/. There is no database, and the app has no accounts.',
    '`--runtime docker`, `podman` or `kubernetes` builds it on Docker Compose, Podman or a Kubernetes cluster instead of DDEV,',
    'at the address that runtime gives (the build prints it); the server is told that address, which it checks forms against.',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the step pack @webship-js/svelte-steps on such an app: its steps',
    'wait for the app to take the page over, follow a navigation inside the app to its end and send a form either way (inside the',
    'page with JavaScript, with a page load without it), and the setup takes --disable-web-security out of the browser\'s arguments,',
    'since a browser started with it sends a form without its Origin header and the app refuses it.',
    `For building or fixing a SvelteKit app (its build, its links and forms), hand over to the agent \`${AGENTS[0]}\`; for testing one, to \`${AGENTS[1]}\`.`,
    `The plugin also places the skill ${SKILLS.map((a) => `\`${a}\``).join(', ')} (the step pack's phrases) in ai-skills/,`,
    `the command ${AI_COMMANDS.map((a) => `\`/${a} <app>\``).join(', ')} in ai-commands/ and the prompts ${PROMPTS.map((a) => `\`${a}\``).join(' and ')} in ai-prompts/.`,
    'Never run node, npm, npx or sv on the host for a project.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
