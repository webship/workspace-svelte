#!/usr/bin/env bash

# workspace-name: Svelte (SvelteKit app)

# Installed by the Svelte plugin (plugins.sh --install svelte); __WORKSPACE__ is the workspace it was installed into.
#
# Make a SvelteKit app with the official create flow (its demo, or its minimal template), or take one from its
# repository with --source, build it with the Node adapter, and serve it from a container of its own: Node.js, the
# app's language, runs in the app's container, never on the machine. With --install the app is served and checked. It
# has no database, and no accounts of the workspace's. The workspace is container-based (DDEV by default, at
# https://<name>.ddev.site); --runtime docker builds it on Docker Compose instead, at the address that runtime gives.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Where the app comes from: nothing means a new app of the create tool.
app_source="";
app_source_ref="";
app_source_path="";

# Distribution.
distribution_name="svelte";
distribution_title="Svelte";
distribution_webroot="app/build";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/svelte/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/svelte/args/arg-svelte.sh || exit 1 ;

shift $#;

svelte_build ;
