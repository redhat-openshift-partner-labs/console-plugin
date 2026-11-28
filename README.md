# OpenShift Partner Labs Console Plugin

This dynamic plugin adds a **Virtualization Demos** page to the OpenShift Console.
Each card on the page starts a `ConsoleQuickStart` walkthrough from
`src/components/DemosPage.tsx`.

`src/cards.yaml` is the card registry, and `src/data/cards.ts` loads it. Each
card carries a topic label (Setup, Create VMs, Operate VMs, Networking, Windows)
and a duration label; `src/data/topics.ts` defines the topics, and the gallery
toolbar filters by them.
`ConsoleQuickStart` chart templates live in
`charts/console-demos-ocp-virtualization/templates/virt-cookbook/`.

To add a walkthrough card, follow the [ConsoleQuickStart demo wiring guide](how-to-create-consolequickstart-demo.md).

The route `$codeRef` values in `console-extensions.json` must match
`consolePlugin.exposedModules` in `package.json`. Run `yarn i18n` after changing
translated strings.

## Create a plugin page

![Create a plugin page: an optional navigation link resolves to the page URL, the URL to a route with a path and $codeRef, the $codeRef to an exposed module in package.json, and the module to a React component.](docs/images/create-plugin-page.svg)

<details>
<summary>Diagram source</summary>

```mermaid
flowchart LR
    nav["Navigation link, optional<br/>href is the page URL<br/>console.navigation/href<br/>console-extensions.json"] --> url["Page URL<br/>the route path a user opens"]
    url --> route["Route<br/>path and $codeRef<br/>console.page/route<br/>console-extensions.json"]
    route --> module["Exposed module<br/>key equals the route $codeRef<br/>consolePlugin.exposedModules<br/>package.json"]
    module --> page["Page component<br/>React function component<br/>src/components/MyPage.tsx"]
    %% $codeRef must equal the exposedModules key in package.json
    %% console-extensions.json changes require restarting yarn start
    %% Run yarn i18n after adding translated strings
```

</details>

Create the component, expose it under a name such as `MyPage`, and use that name
as the route's `$codeRef`. The route's `path` is the URL to open. To make the page
discoverable, add a navigation link whose `href` is that path.

This repository can be used as a template. Use GitHub's **Use this template**
action, then update plugin metadata, the i18n namespace, route paths, CSS
prefix, and Helm values.

## Requirements

| Requirement               | Version                                   | Needed for                                                                        |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| OpenShift Console         | 4.19 or newer                             | Running the plugin. This build uses the 4.19 Console plugin SDK and PatternFly 6. |
| Node.js                   | 24, from `.nvmrc`                         | Building the plugin. The Docker image, CI, and devcontainer also use Node.js 24.  |
| Yarn                      | 4.18.0, checked in under `.yarn/releases` | `make install` and every `yarn` script.                                           |
| Helm                      | 3.17 or newer                             | `make deploy`, which passes `--take-ownership`, and `yarn validate:quickstarts`.  |
| `oc` with a cluster login |                                           | `yarn start-console` and deployment.                                              |
| Podman or Docker          |                                           | The local Console container and the image build.                                  |

The build supports the 4.19–4.21 compatibility router and the 4.22+ router
bridge. Console 4.22 changed its shared React, router, and i18n versions, so
validate the plugin on each Console release you deploy to.

Every card's walkthrough requires the `ConsoleQuickStart` resource installed by
the Helm chart. Running only the local plugin server installs none of them.

## Develop

1. Run `make install`.
2. Run `yarn start`. The webpack dev server listens on port 9001.
3. Run `oc login` against the cluster.
4. In another terminal, run `yarn start-console`.
5. Open <http://localhost:9000/console-demos-ocp-virtualization>.

![Local development topology: the developer browser opens the Console container on port 9000, which loads plugin assets from the webpack dev server on port 9001 and reaches the cluster API server with the oc token.](docs/images/local-dev.svg)

<details>
<summary>Diagram source</summary>

```mermaid
flowchart LR
    dev([Developer browser]) -->|"http://localhost:9000/console-demos-ocp-virtualization"| console["Console container<br/>quay.io/openshift/origin-console:latest<br/>port 9000<br/>yarn start-console"]
    console -->|"BRIDGE_PLUGINS<br/>plugin assets"| wds["webpack dev server<br/>yarn start<br/>port 9001<br/>serves dist/ with CORS headers"]
    console -->|"bearer token from oc whoami --show-token"| api["Cluster API server<br/>endpoint from oc whoami --show-server"]
    files["Source files<br/>src/, locales/, console-extensions.json"] -->|"built on change"| wds
    %% Login first: run oc login before yarn start-console
    %% Quick Starts: ConsoleQuickStart resources are not installed by the local server
    %% Extensions: console-extensions.json changes require restarting yarn start
    %% Auth: Console user auth is disabled; requests use the oc token
    %% Plugin host: podman host.containers.internal, docker host.docker.internal, container bridge100 address, podman on Linux localhost with --network=host
```

</details>

Use the project selector above the Demos tabs to change the active Console
project. Activity shows the labeled resources in that project; **All projects**
shows none.

Run `make help` to see the available workflows. `make check` runs linting,
unit tests, Quick Start validation, and the plugin build. Note that the existing
`yarn lint` script applies fixes, so `make lint` and `make check` can update
files.

## Deploy

Build, push, and deploy an image in order with `make release`:

```sh
make release IMAGE=quay.io/your-namespace/console-demos-ocp-virtualization:latest
```

The `build`, `push`, and `deploy` targets are also available individually;
`make build-push` combines the first two. The container engine defaults to
Podman; set `CONTAINER_ENGINE=docker` to use Docker. The build platform defaults
to `linux/amd64`, which is useful when building for amd64 OpenShift nodes from
Apple Silicon. The release and namespace default to
`console-demos-ocp-virtualization`; override them with `RELEASE` and `NAMESPACE`.
Set `KUBE_CONTEXT` to select a specific cluster context for deployment.

Deploy a pull request to a test cluster with one target:

```sh
make deploy-pr PR=50 IMAGE_REGISTRY=quay.io/your-namespace
```

This checks out the PR, builds and pushes
`quay.io/your-namespace/pr-50-quickstart:latest`, then upgrades the default Helm
release and namespace (`console-demos-ocp-virtualization`). Cluster-scoped chart
resources such as `ConsolePlugin` keep that fixed name, so a separate PR release
cannot adopt them. Deploy uses Helm `--take-ownership` so existing
`ConsoleQuickStart` and related objects without Helm annotations can be adopted
into that release. Override `RELEASE` or `NAMESPACE` only when intentionally
replacing a non-default install. Helm uses the current context from
`KUBECONFIG` or the default kubeconfig; set `KUBE_CONTEXT` only to override that
context. The working tree must be clean, and the selected container engine must
be logged in to the image registry; the cluster must be able to pull the image.
The target leaves the working tree checked out to the PR. Set `IMAGE` to a full
image reference to override the generated image name. Requires Helm 3.17+.

Reviewers can check out a pull request with `make checkout-pr PR=<number>`.
This target requires the GitHub CLI and a clean working tree.

Set `plugin.quickStarts.vm-instancetypes-and-preferences.enabled=false` to omit the
walkthrough resource.

The **Create a VM from the web console** card launches the `create-vm-web-console`
Quick Start, adapted from the VM cookbook's `create-vm-web-console.adoc`. It covers
template selection, customization, provisioning, console access, lifecycle
operations, monitoring, and optional cleanup. Set
`plugin.quickStarts.create-vm-web-console.enabled=false` to omit its resource.

The **Create custom VM templates** card launches the `vm-templates` Quick Start,
adapted from the VM cookbook's `vm-templates.adoc`. It covers CLI template
inspection, baseline VM deployment, custom template registration, parameter
processing, guest login, and cleanup of a dedicated tutorial project. Set
`plugin.quickStarts.vm-templates.enabled=false` to omit its resource.
