Feature: A SvelteKit app on Docker Compose, Podman and Kubernetes
  The builder builds on DDEV by default, and with --runtime on Docker Compose, Podman or a Kubernetes cluster. An app
  built there has the row a DDEV project has: its state, its own address and the runtime's menu, and its own server
  serves it.

  # Each scenario drives a real app of that runtime, built with cmd-svelte-project.sh --runtime: the first running one
  # the workspace holds. Without one it is skipped, with the reason. In the plugin's CI the Docker Compose app is the
  # one the manifest's featuresSite builds: the demo of the create tool, ci-svelte.

  @needs-runtime-docker @needs-platform-svelte
  Scenario: A SvelteKit app built on Docker Compose runs at its own address, with the DOCKER menu
    Given I am on the folder of the "docker" site
     Then the row of the "docker" site should show "Running"
      And the row of the "docker" site should link to the address of its runtime
      And the address of the "docker" site should answer
      And the row of the "docker" site should carry the "DOCKER" menu and no DDEV menu

  # The app takes the server's page over in the browser once its start script has run: the live region it then adds
  # for screen readers says it has.
  @needs-runtime-docker @needs-platform-svelte
  Scenario: The app on Docker Compose is the built SvelteKit app, and it takes its page over
    Given I am on the folder of the "docker" site
     When I open "/" on the "docker" site
     Then "#svelte-announcer" should be attached within 30 seconds

  @needs-runtime-podman @needs-platform-svelte
  Scenario: A SvelteKit app built on Podman runs at its own address, with the PODMAN menu
    Given I am on the folder of the "podman" site
     Then the row of the "podman" site should show "Running"
      And the row of the "podman" site should link to the address of its runtime
      And the address of the "podman" site should answer
      And the row of the "podman" site should carry the "PODMAN" menu and no DDEV menu

  @needs-runtime-podman @needs-platform-svelte
  Scenario: The app on Podman is the built SvelteKit app, and it takes its page over
    Given I am on the folder of the "podman" site
     When I open "/" on the "podman" site
     Then "#svelte-announcer" should be attached within 30 seconds

  @needs-runtime-kubernetes @needs-platform-svelte
  Scenario: A SvelteKit app built on Kubernetes runs at the address of its node, with the K8S menu
    Given I am on the folder of the "kubernetes" site
     Then the row of the "kubernetes" site should show "Running"
      And the row of the "kubernetes" site should link to the address of its runtime
      And the address of the "kubernetes" site should answer
      And the row of the "kubernetes" site should carry the "K8S" menu and no DDEV menu

  @needs-runtime-kubernetes @needs-platform-svelte
  Scenario: The app on Kubernetes is the built SvelteKit app, and it takes its page over
    Given I am on the folder of the "kubernetes" site
     When I open "/" on the "kubernetes" site
     Then "#svelte-announcer" should be attached within 30 seconds
