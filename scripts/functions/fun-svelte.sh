#!/usr/bin/env bash

# Svelte for the Webship Workspace: make a SvelteKit app with the official create flow (or take one from its
# repository), build it with the Node adapter and serve it from a container of its own, and wire the Svelte step pack
# into the testing setup of that app.
#
# Placed by `plugins.sh --install svelte` in core/scripts/plugins/svelte/functions/, where bootstrap sources it after
# the core's own functions. Everything runs in the project's containers, never on the host: Node.js is the app's
# language and runs in the app's own container, where the app is made (`sv create`, the create tool pinned), built
# (`npm run build`) and served by the Node adapter's own server (`node build`).
#   - DDEV (the default): a project with DDEV's generic web server and the Node.js of the workspace rule in its web
#     container; the app's server is a daemon of the web container, and the router sends the project's address to it
#     (.ddev/config.svelte.yaml).
#   - Docker Compose, Podman and Kubernetes (--runtime docker, podman, kubernetes): the language stack of the core's
#     runtime layer (webship/workspace#841): Node.js's own image at the same major version (rt_stack node), and the
#     app's server as the web container's own (rt_serve); at http://127.0.0.1:<port>, or on Kubernetes (kind) at the
#     node's address and a NodePort, the project's folder mounted from the host. There is no database, so Kubernetes
#     needs core 1.0.35 or newer (webship/workspace#884).
# Lando and Docksal are not proven for it yet: asked for one, the builder says so and changes nothing.
#
# The app checks the origin of every form it is sent against its own address (its protection against cross-site
# forms), and the Node adapter cannot tell that address from a request behind a proxy or on a plain port: the
# builder gives the server the project's address (ORIGIN), as the runtime says it.
#
# The project's folder: app/ (the SvelteKit app: the demo or the minimal template of the create tool, or a repository
# cloned with --source) and app/build/ (the built server, which is served). There is no database.
#
# The container tool has no project type for SvelteKit, so a project of this builder is recognised by its mark
# (.ddev/config.svelte.yaml on DDEV, `platform: svelte` in compose.yaml elsewhere), and four names are the ones the
# core's tools look for:
#   set_svelte_users          an empty list: the app has no accounts of the workspace's  (cmd-tools-add-users.sh)
#   add_svelte_users          says so, and adds nothing                                    (the same tool)
#   cancel_svelte_users       says so, and removes nothing                                 (cmd-tools-cancel-users.sh)
#   testing_configure_svelte  the step pack in the testing stack                           (cmd-tools-testing.sh)

# The step pack an app is tested with, and the release line it is required at.
readonly SVELTE_STEPS_PACKAGE='@webship-js/svelte-steps';
readonly SVELTE_STEPS_VERSION='^2.0.0';

# The create tool of the Svelte project (https://github.com/sveltejs/cli), at the release the builder is proven with.
readonly SVELTE_SV_VERSION='1.7.1';

# Node.js, the app's language, at the major version of the workspace rule: DDEV's web container on DDEV, the stack's
# image (node:<version>-bookworm-slim) on another runtime.
readonly SVELTE_NODE_VERSION='24';

# The port the app's server listens on in the web container, and the app's folder.
readonly SVELTE_PORT='3000';
readonly SVELTE_APP='app';

# The templates of the create tool a new app can be made from, and the runtimes an app is built on.
readonly SVELTE_TEMPLATES='demo minimal';
readonly SVELTE_RUNTIMES='ddev docker podman kubernetes';

# The app has no accounts of the workspace's: the list is empty.
function set_svelte_users() {
  users=();
}

# The runtime of the project in this folder, or of a new build (--runtime, else the workspace's setting, else DDEV).
# A core without the runtime layer has DDEV only.
function svelte_runtime() {
  if declare -f runtime_of > /dev/null ; then runtime_of ; else echo 'ddev' ; fi
}

# The address of the app in this folder: https://<name>.ddev.site on DDEV, http://127.0.0.1:<port> on Docker Compose
# and Podman, the node's address and a port on Kubernetes. Asked after `ddev config`.
function svelte_url() {
  if declare -f rt_url > /dev/null ; then rt_url ; else echo "https://${PROJECT_NAME}.ddev.site" ; fi
}

# The project's folder in the web container.
function svelte_root() {
  echo '/var/www/html' ;
}

# Is this folder a project of the Svelte builder? On DDEV the builder leaves .ddev/config.svelte.yaml in it; on another
# runtime it claims the project (`platform: svelte` in the x-webship block).
function svelte_is_project() {
  local project_path="$1";
  [ -f "${project_path}/.ddev/config.svelte.yaml" ] && return 0 ;
  declare -f rt_is_platform > /dev/null && rt_is_platform "${project_path}" svelte ;
}

# The command that serves the built app once it is there: the Node adapter's own server, on SVELTE_PORT, told the
# address the browser opens (ORIGIN), which it checks a form's origin against. No space before a `;`: in the
# supervisor configuration DDEV writes from it, " ;" starts a comment.
function svelte_serve_command() {
  local origin="$1" root ; root="$(svelte_root)" ;
  echo "while [ ! -f ${root}/${SVELTE_APP}/build/index.js ]; do sleep 2; done; cd ${root}/${SVELTE_APP} && exec env PORT=${SVELTE_PORT} HOST=0.0.0.0 ORIGIN=${origin} node build" ;
}

# What DDEV is told about the app: the router sends the project's address to the app's server, which the web container
# runs as a daemon. The file also marks the project as one of this builder.
function svelte_write_ddev_config() {
  local project_path="$1" made="$2" origin="$3" ;
  mkdir -p "${project_path}/.ddev" || return 1 ;
  cat > "${project_path}/.ddev/config.svelte.yaml" <<YAMLEOF
# A SvelteKit app in this project. Written by the Svelte builder of the workspace; build again rather than editing by
# hand. The web container serves no files of its own: the router sends ports 80 and 443 of the project's address to
# the app's server, a daemon of the web container that runs the built app (${SVELTE_APP}/build) with the Node adapter's
# own server once it is there, told the project's address (ORIGIN).
# app: ${made}
web_extra_exposed_ports:
  - name: svelte
    container_port: ${SVELTE_PORT}
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: svelte
    command: "bash -c '$(svelte_serve_command "${origin}")'"
    directory: $(svelte_root)
YAMLEOF
}

# On another runtime than DDEV (webship/workspace#841): the plugin's claim, Node.js's own image as the stack, and the
# app's server as the web container's own, once the app is built.
function svelte_runtime_config() {
  local origin="$1" ;
  rt_claim svelte || return 1 ;
  rt_stack node "${SVELTE_NODE_VERSION}" || return 1 ;
  rt_serve "${SVELTE_PORT}" "$(svelte_serve_command "${origin}")" ;
}

# Wait until the app's server answers (any answer of HTTP: an app of your own may ask for a sign-in at its root).
function svelte_wait() {
  local attempt ;
  for attempt in $(seq 1 60) ; do
    if ddev exec "curl -sS -o /dev/null http://127.0.0.1:${SVELTE_PORT}/" < /dev/null > /dev/null 2>&1 ; then
      return 0 ;
    fi
    sleep 2 ;
  done
  echo "The app's server does not answer." ;
  return 1 ;
}

# The package manager of an app from its lock file: npm (package-lock.json, or none), pnpm or yarn, the last two through
# Node.js's corepack. Bun is not in the app's container.
function svelte_package_manager() {
  local app="$1" ;
  if [ -f "${app}/pnpm-lock.yaml" ] ; then echo 'pnpm' ;
  elif [ -f "${app}/yarn.lock" ] ; then echo 'yarn' ;
  elif [ -f "${app}/bun.lock" ] || [ -f "${app}/bun.lockb" ] ; then echo 'bun' ;
  else echo 'npm' ; fi
}

# The release line of the Node adapter made for each major version of SvelteKit (the adapter's own peer dependency).
readonly SVELTE_ADAPTER_FOR_KIT='1:^1.0.0 2:^5.0.0 3:^6.0.0';

# The Node adapter in an app's package.json at the release line made for the app's SvelteKit. The create tool's add-on
# adds the adapter's latest release, which is SvelteKit 3's: an app on SvelteKit 2 needs the adapter's 5.x (the 6.x
# fails its build, reading a configuration SvelteKit 2 does not give it). A SvelteKit the table does not know, or a
# range without a major version, leaves the adapter as it is, and so does an adapter already of the right major.
function svelte_match_adapter() {
  local app="$1" ;
  python3 - "${app}/package.json" "${SVELTE_ADAPTER_FOR_KIT}" <<'PYEOF' || return 1
import json, re, sys
path, table = sys.argv[1], dict(pair.split(':', 1) for pair in sys.argv[2].split())
pkg = json.load(open(path))
kit = next((pkg[s]['@sveltejs/kit'] for s in ('dependencies', 'devDependencies') if '@sveltejs/kit' in pkg.get(s, {})), '')
major = re.search(r'\d+', kit)
want = table.get(major.group(0)) if major else None
for section in ('dependencies', 'devDependencies'):
    have = pkg.get(section, {}).get('@sveltejs/adapter-node')
    if have is None:
        continue
    same = re.search(r'\d+', have)
    if want and not (same and same.group(0) == re.search(r'\d+', want).group(0)):
        pkg[section]['@sveltejs/adapter-node'] = want
        open(path, 'w').write(json.dumps(pkg, indent=2) + '\n')
        print('The app is on SvelteKit %s (%s): the Node adapter of its release line, @sveltejs/adapter-node %s.' % (major.group(0), kit, want))
    break
PYEOF
}

# The command line of a package manager in the container: pnpm and yarn through corepack, without its prompt.
function svelte_pm() {
  case "$1" in
    npm) echo 'npm' ;;
    *) echo "COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack $1" ;;
  esac
}

# The app in app/: a new one of the create tool (its demo or its minimal template, in TypeScript, with the Node adapter),
# or the folder of a repository. An app of your own must be a SvelteKit app whose packages are its own (not those of a
# workspace of its repository); one built with another adapter gets the Node adapter, through the create tool's own
# add-on, so that it serves itself.
function svelte_get_app() {
  local project_path="$1" template="$2" source="$3" ref="$4" app_path="$5" root ;
  root="$(svelte_root)" ;
  if [ -z "${source}" ] ; then
    echo "Making a new app with the create tool (sv ${SVELTE_SV_VERSION}): its ${template} template, in TypeScript, with the Node adapter." ;
    ddev exec -d "${root}" "npx --yes sv@${SVELTE_SV_VERSION} create --template ${template} --types ts --add sveltekit-adapter='adapter:node' --install npm --no-dir-check ${SVELTE_APP}" < /dev/null \
      || { echo "sv create failed." ; return 1 ; } ;
    return 0 ;
  fi
  echo "Getting the app: ${source}${ref:+ at ${ref}}${app_path:+, its folder ${app_path}/}" ;
  ddev exec "rm -rf /tmp/svelte-source && git clone --quiet --depth 1 ${ref:+--branch '${ref}'} '${source}' /tmp/svelte-source" < /dev/null \
    || { echo "The app could not be cloned from ${source}${ref:+ at ${ref}}." ; return 1 ; } ;
  ddev exec "test -f '/tmp/svelte-source/${app_path:+${app_path}/}package.json' && mkdir -p ${root}/${SVELTE_APP} && cp -a '/tmp/svelte-source/${app_path:+${app_path}/}.' ${root}/${SVELTE_APP}/ && rm -rf ${root}/${SVELTE_APP}/.git" < /dev/null \
    || { echo "${source}${app_path:+ (${app_path}/)} has no package.json: it is not the folder of an app." ; return 1 ; } ;
  ddev exec "rm -rf /tmp/svelte-source" < /dev/null ;
  local app="${project_path}/${SVELTE_APP}" ;
  if ! grep -q '"@sveltejs/kit"' "${app}/package.json" ; then
    echo "${source}${app_path:+ (${app_path}/)} is not a SvelteKit app (its package.json does not list @sveltejs/kit): this builder makes and serves SvelteKit apps." ;
    return 1 ;
  fi
  if grep -q '"workspace:' "${app}/package.json" ; then
    echo "The app takes packages of a workspace of its repository (\"workspace:\" in its package.json), which are not copied with it: build it from a repository of its own." ;
    return 1 ;
  fi
  local pm ; pm="$(svelte_package_manager "${app}")" ;
  if [ "${pm}" = 'bun' ] ; then
    echo "The app is installed with Bun (its lock file), which is not in the app's container: npm, pnpm and yarn are." ;
    return 1 ;
  fi
  if ! grep -q '"@sveltejs/adapter-node"' "${app}/package.json" ; then
    echo "The app builds with another adapter: switching it to the Node adapter (sv add sveltekit-adapter=adapter:node), so it serves itself." ;
    ddev exec -d "${root}/${SVELTE_APP}" "npx --yes sv@${SVELTE_SV_VERSION} add sveltekit-adapter='adapter:node' --no-git-check --no-install" < /dev/null \
      || { echo "The Node adapter could not be added to the app." ; return 1 ; } ;
    svelte_match_adapter "${app}" || { echo "The Node adapter's release could not be matched to the app's SvelteKit." ; return 1 ; } ;
  fi
  echo "Installing the app's packages with ${pm}." ;
  ddev exec -d "${root}/${SVELTE_APP}" "$(svelte_pm "${pm}") install" < /dev/null \
    || { echo "${pm} install failed." ; return 1 ; } ;
}

# Build an app from nothing: the project and its container, the app, its build with the Node adapter, and with
# --install the app served and checked.
function svelte_build() {
  trim_project_name ;
  local base_url runtime ;
  runtime="$(svelte_runtime)" ;
  if [ "${RUNTIME:-_none_}" != '_none_' ] && [ "${RUNTIME}" != "${runtime}" ] ; then
    echo "--runtime ${RUNTIME} needs a Webship Workspace with the container runtimes (webship/workspace#694): update the workspace, or build on DDEV." ;
    exit 1 ;
  fi
  case " ${SVELTE_RUNTIMES} " in
    *" ${runtime} "*) ;;
    *) echo "A SvelteKit app builds on DDEV, Docker Compose, Podman and Kubernetes for now (--runtime ddev, docker, podman or kubernetes), not on ${runtime}: that runtime is not proven for it yet. Nothing was changed." ; exit 1 ;;
  esac
  if [ "${runtime}" != 'ddev' ] && ! declare -f rt_serve > /dev/null ; then
    echo "Svelte on ${runtime} needs a Webship Workspace whose runtimes take an application's own language and server (webship/workspace#841, core 1.0.32 or later): update the workspace, or build on DDEV." ;
    exit 1 ;
  fi
  local source="${SOURCE:-${app_source:-}}" ;
  local ref="${REF:-${app_source_ref:-}}" ;
  local app_path="${APP_PATH:-${app_source_path:-}}" ;
  local template="${TEMPLATE:-_none_}" ;
  [ "${template}" = '_none_' ] && template='' ;
  if [ -n "${template}" ] && [ -n "${source}" ] ; then
    echo "--template makes a new app, and --source takes an app of your own: give one of them. Nothing was changed." ;
    exit 1 ;
  fi
  [ -z "${source}" ] && template="${template:-demo}" ;
  case " ${SVELTE_TEMPLATES} " in
    *" ${template:-demo} "*) ;;
    *) echo "--template takes demo or minimal, the templates of the create tool a new app is made from. Nothing was changed." ; exit 1 ;;
  esac
  if [ -n "${app_path}" ] && [ -z "${source}" ] ; then
    echo "--path names a folder of the repository given with --source: give --source too. Nothing was changed." ;
    exit 1 ;
  fi
  if [[ "${app_path}" == /* ]] || [[ "/${app_path}/" == */../* ]] || [[ "${app_path}" == *"'"* ]] || [[ "${source}${ref}" == *"'"* ]] ; then
    echo "--source, --ref and --path take a repository, a branch or tag, and a folder inside the repository. Nothing was changed." ;
    exit 1 ;
  fi
  if [ ${#PROJECT_NAME} -gt 40 ] || ! [[ "${PROJECT_NAME}" =~ ^[a-z0-9][a-z0-9-]*$ ]] ; then
    echo "The project name ${PROJECT_NAME} must be small letters, digits and dashes (its address and its containers take it). Nothing was changed." ;
    exit 1 ;
  fi
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" ;
  local root ; root="$(svelte_root)" ;
  local made ;
  if [ -n "${source}" ] ; then made="${source}${ref:+ (${ref})}${app_path:+, ${app_path}/}" ; else made="the ${template} template of sv ${SVELTE_SV_VERSION}" ; fi

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  # A project of the same name goes first, with its containers.
  drop_database ;
  rm -rf "${PROJECT_NAME:?}" ;
  mkdir -p "${PROJECT_NAME}" ;
  cd "${project_path}" || exit 1 ;

  # A generic web server, no database, and Node.js in the app's container: the app's own server serves it.
  if [ "${runtime}" == 'ddev' ] ; then
    ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
      --omit-containers=db --nodejs-version=$(ddev_nodejs_version) < /dev/null || exit 1 ;
    # The address is the runtime's to say, once the project is configured: never a written ddev.site.
    base_url="$(svelte_url)" ;
    svelte_write_ddev_config "${project_path}" "${made}" "${base_url}" || exit 1 ;
  else
    # The runtime's own project: Docker Compose, Podman or Kubernetes, through the runtime layer.
    ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
      --omit-containers=db --auto < /dev/null || exit 1 ;
    base_url="$(svelte_url)" ;
    svelte_runtime_config "${base_url}" || { echo "The app's stack could not be written through the runtime layer." ; exit 1 ; } ;
  fi

  echo "Starting the project: Node.js ${SVELTE_NODE_VERSION} in the app's container." ;
  ddev_up start -y < /dev/null || exit 1 ;

  svelte_get_app "${project_path}" "${template}" "${source}" "${ref}" "${app_path}" || exit 1 ;

  local pm ; pm="$(svelte_package_manager "${project_path}/${SVELTE_APP}")" ;
  echo "Building the app with the Node adapter: ${pm} run build." ;
  ddev exec -d "${root}/${SVELTE_APP}" "$(svelte_pm "${pm}") run build" < /dev/null \
    || { echo "The app's build failed." ; exit 1 ; } ;
  if [ ! -f "${project_path}/${SVELTE_APP}/build/index.js" ] ; then
    echo "The build left no ${SVELTE_APP}/build/index.js: the app is not built with the Node adapter." ;
    exit 1 ;
  fi

  [ "${ADD_USERS}" == 'yes' ] && echo "--add-users: the app has no accounts of the workspace's; nothing is added." ;

  if [ "${INSTALL}" == 'yes' ] ; then
    svelte_wait || exit 1 ;
    echo "${doc_name} ${PROJECT_NAME} is served: the SvelteKit app in ${SVELTE_APP}/ (${made}), built with the Node adapter.";
    echo "Go to ${base_url}";
  else
    ddev stop < /dev/null ;
    echo "${doc_name} ${PROJECT_NAME} is ready: the SvelteKit app in ${SVELTE_APP}/ (${made}), built with the Node adapter.";
    if [ "${runtime}" = 'ddev' ] ; then
      echo "Serve it with: cd ${PROJECT_NAME} && ddev start   (or build with --install)";
    else
      echo "Serve it with Start in its row of the dashboard (or build with --install)";
    fi
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The app has no accounts of the workspace's: there is nothing to add, and nothing to remove.
function add_svelte_users() {
  echo "The SvelteKit app has no accounts of the workspace's, so there are none to add." ;
}

function cancel_svelte_users() {
  echo "The SvelteKit app has no accounts of the workspace's, so there are none to remove." ;
}

# The step pack in the testing stack of an app of this builder. The core's testing_configure calls this in the project
# folder once webship-js is scaffolded and before the dependencies are installed; for a project that is not an app of
# this builder it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's own, takes
# --disable-web-security out of playwright.config.ts (a browser started with it sends a form without its Origin header,
# and the app refuses every form it checks the origin of with 403), and, for the demo of the create tool, writes a
# first feature when the project has none of its own. There is no users registry: the app has no accounts. Every part
# is skipped when it is already done, so a second run adds what the first missed and never resets a suite. The suite is
# the project's (its package.json, cucumber.js and tests/ are next to app/, not in it).
function testing_configure_svelte() {
  local project_path="$1";
  svelte_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Svelte: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Svelte step pack (${SVELTE_STEPS_PACKAGE} ${SVELTE_STEPS_VERSION}).";

  python3 - "${project_path}" "${SVELTE_STEPS_PACKAGE}" "${SVELTE_STEPS_VERSION}" <<'PYEOF' || return 1
import json, os, re, sys

project, pack, version = sys.argv[1:4]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if src != before:
    open(cucumber_file, 'w').write(src)

# playwright.config.ts: no --disable-web-security. With it the browser sends a form posted with fetch without its
# Origin header, and the app refuses it (403 "Cross-site POST form submissions are forbidden").
config_file = project + '/playwright.config.ts'
if os.path.exists(config_file):
    config = open(config_file).read()
    kept = re.sub(r"^[ \t]*['\"]--disable-web-security['\"],?[ \t]*\n", '', config, flags=re.M)
    if kept != config:
        open(config_file, 'w').write(kept)
        print("  playwright.config.ts: --disable-web-security taken out of the browser's arguments: with it the browser sends a form without its Origin header, and the app refuses every form with 403")
PYEOF

  # A first feature, for the demo of the create tool only (an app of your own has its own names), when the project has
  # none for the app yet.
  local feature="${WORKSPACE_SCRIPTS}/plugins/svelte/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    if [ -f "${project_path}/${SVELTE_APP}/src/routes/sverdle/+page.svelte" ] ; then
      mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
        && echo "  tests/features/site.feature: a first feature for the demo" ;
    else
      echo "  Svelte: the app is not the demo of the create tool, so no first feature is written: write one from what its pages show." ;
    fi
  fi
}
