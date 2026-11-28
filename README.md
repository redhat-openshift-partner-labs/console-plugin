# OpenShift Partner Labs Console Plugin

This OpenShift Console dynamic plugin adds a **Virtualization Demos** page of
guided OpenShift Virtualization demos for partners evaluating OpenShift
Virtualization and for the contributors who write those demos.

## Cards

Each card on the page starts one demo, a `ConsoleQuickStart`, in the Console
Quick Start drawer. `src/cards.yaml` is the card registry, `src/data/cards.ts`
loads it, and `src/components/DemosPage.tsx` renders the gallery. The
`ConsoleQuickStart` templates live in
`charts/console-demos-ocp-virtualization/templates/virt-cookbook/`.

Each card shows a topic label and a duration label, and the toolbar filters by
topic. `src/data/topics.ts` defines the five topics:

| Topic       | Covers                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Setup       | Installing OpenShift Virtualization and the LVM Storage Operator.                                       |
| Create VMs  | Creating VMs from the web console, CLI YAML, templates, instance types, cloud-init, and multiple disks. |
| Operate VMs | virtctl, lifecycle states, cloning, node placement, monitoring, and export and import.                  |
| Networking  | HTTPS Routes, NetworkPolicy, and static IP addresses.                                                   |
| Windows     | VirtIO drivers, golden images, and SSH access.                                                          |

The duration label reads `durationMinutes` from the card entry, which must
equal the resource's `spec.durationMinutes`; `yarn validate:quickstarts`
checks it.

## Requirements

| Requirement               | Version                                   | Needed for                                                                        |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| OpenShift Console         | 4.19 or newer                             | Running the plugin. This build uses the 4.19 Console plugin SDK and PatternFly 6. |
| Node.js                   | 24, from `.nvmrc`                         | Building the plugin. The Docker image, CI, and devcontainer also use Node.js 24.  |
| Yarn                      | 4.18.0, checked in under `.yarn/releases` | `make install` and every `yarn` script.                                           |
| Helm                      | 3.17 or newer                             | `make deploy`, which passes `--take-ownership`, and `yarn validate:quickstarts`.  |
| `oc` with a cluster login |                                           | `yarn start-console` and the verification commands.                               |
| Podman or Docker          |                                           | The local Console container and the image build.                                  |

The build supports the 4.19–4.21 compatibility router and the 4.22+ router
bridge. Console 4.22 changed its shared React, router, and i18n versions, so
validate the plugin on each Console release you deploy to.

Every demo requires its `ConsoleQuickStart` resource, installed by the Helm
chart. Running only the local plugin server installs none of them.

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

## Add a demo

The plugin supplies a launch card; the Console displays the demo from an
installed `ConsoleQuickStart` resource. Use the
[OpenShift Quick Start authoring guide](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/web_console/creating-quick-start-tutorials)
for the resource schema and the demo content.

![Demo card wiring: in the plugin image, src/cards.yaml is loaded by src/data/cards.ts, rendered by DemosPage.tsx, and launched with setActiveQuickStart; in the Helm chart, the values.yaml switch renders the CR template, Helm installs the ConsoleQuickStart, and the Console displays it.](docs/images/card-wiring.svg)

<details>
<summary>Diagram source</summary>

```mermaid
flowchart TB
    subgraph plugin["Plugin image"]
        card["Card registry<br/>src/cards.yaml<br/>id, quickStartId, kind<br/>topic, durationMinutes"]
        loader["Card loader<br/>src/data/cards.ts<br/>loads the registry as DemoCard[]"]
        gallery["Gallery<br/>DemosPage.tsx<br/>the user clicks the card"]
        launch["Launch<br/>useQuickStartContext<br/>setActiveQuickStart(card.quickStartId)"]
        card --> loader --> gallery --> launch
    end

    subgraph chart["Helm chart"]
        values["Install switch<br/>values.yaml<br/>plugin.quickStarts.my-demo.enabled"]
        manifest["CR template<br/>templates/virt-cookbook/my-demo.yaml<br/>metadata.name: my-demo"]
        values -->|"enabled: true"| manifest
    end

    manifest -->|"Helm installs"| resource[("ConsoleQuickStart<br/>cluster scoped<br/>metadata.name: my-demo")]
    launch -->|"selects my-demo"| console["OpenShift Console<br/>displays the demo<br/>Quick Start drawer"]
    resource -->|"demo content"| console
    %% One name: the card id, quickStartId, template filename, metadata.name, and the Helm switch use the same name
    %% Labels: durationMinutes must equal spec.durationMinutes; topic is one of setup, create, operate, networking, windows
    %% Local server: yarn start does not install the resource, and the gallery does not check whether it exists
    %% Disabled switch: enabled: false omits the resource but leaves the card in the bundle
```

</details>

| Piece                | Location                                                                                       | Role                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Card registry        | [`src/cards.yaml`](src/cards.yaml)                                                             | `kind: quickstart` selects the launch behavior; `quickStartId` identifies the resource; `topic` and `durationMinutes` fill the two card labels. |
| Card type and loader | [`src/data/cards.ts`](src/data/cards.ts)                                                       | Loads the registry into the plugin bundle as `DemoCard[]`.                                                                                      |
| Topics               | [`src/data/topics.ts`](src/data/topics.ts)                                                     | `TOPIC_IDS` lists the allowed `topic` values and their labels and colors.                                                                       |
| Launch handler       | [`src/components/DemosPage.tsx`](src/components/DemosPage.tsx)                                 | Calls `setActiveQuickStart?.(card.quickStartId)` through the SDK's `useQuickStartContext`.                                                      |
| CR templates         | [`templates/virt-cookbook/`](charts/console-demos-ocp-virtualization/templates/virt-cookbook/) | Helm installs the demo resources.                                                                                                               |
| Install switches     | [`values.yaml`](charts/console-demos-ocp-virtualization/values.yaml)                           | `plugin.quickStarts.<name>.enabled` controls whether each resource is rendered.                                                                 |

**Use one name for all four identifiers:** the card's `id`, its `quickStartId`,
the template filename `<name>.yaml`, and the resource's `metadata.name`. Use that
same name for the Helm switch `plugin.quickStarts.<name>.enabled`. For example,
`create-vm-web-console` is both card identifiers, the filename is
`create-vm-web-console.yaml`, and the resource's `metadata.name` is
`create-vm-web-console`. The SDK launch itself resolves the resource through
`quickStartId`. Card IDs must be unique.

The card title and the resource's `spec.displayName` are separate: the first
appears in the gallery, the second in the Quick Start drawer. The card's
`durationMinutes` must equal the resource's `spec.durationMinutes`; the
validator rejects a difference. The card's `topic` must be one of `setup`,
`create`, `operate`, `networking`, or `windows` from `src/data/topics.ts`. A
demo card needs no new route or exposed module.

### Steps

1. Copy an existing template, such as
   [`vm-templates.yaml`](charts/console-demos-ocp-virtualization/templates/virt-cookbook/vm-templates.yaml),
   to `templates/virt-cookbook/my-demo.yaml`. Set `metadata.name` and the Helm
   condition to `my-demo`, then replace the demo content. Preserve the
   chart label helper. For `my-demo`, the condition is:

   ```gotemplate
   {{- if (index .Values.plugin.quickStarts "my-demo").enabled }}
   ```

   Keep the closing `{{- end }}`. The resource is cluster scoped; omit
   `metadata.namespace`.

2. Add its install switch under `plugin.quickStarts` in `values.yaml`:

   ```yaml
   my-demo:
     enabled: true
   ```

3. Append a unique card to `src/cards.yaml`:

   ```yaml
   - id: my-demo
     kind: quickstart
     topic: operate
     durationMinutes: 20
     title: My demo
     body: Guided steps for my demo.
     quickStartId: my-demo
   ```

### Verify

Card metadata ships in the plugin image; resource content and install switches
ship in the Helm chart. Rebuild and deploy the image for card changes, and
upgrade the Helm release for resource changes, as described under
[Deploy](#deploy). `yarn start` alone does not install the resource on your
development cluster.

Render the new template and confirm the installed resource:

```sh
helm template console-demos-ocp-virtualization charts/console-demos-ocp-virtualization \
  --set plugin.image=quay.io/my-repository/console-demos-ocp-virtualization:latest \
  --show-only templates/virt-cookbook/my-demo.yaml
oc get consolequickstart my-demo
```

The parameterized launch test in
[`DemosPage.spec.tsx`](src/components/DemosPage.spec.tsx) discovers demo
cards from the registry. Add an opening check in
[`card-page.spec.ts`](integration-tests/tests/card-page.spec.ts), following the
existing tests: click `card-action-my-demo`, then assert the Quick Start heading
and initial content. Run `yarn test` and verify the card at
`/console-demos-ocp-virtualization` against a cluster with the resource
installed.

Setting `plugin.quickStarts.my-demo.enabled=false` omits the resource but leaves
its card in the bundle. The gallery does not check whether the resource exists.
If a card does not open its demo, check the installed resource name,
`quickStartId`, and the Helm switch first.

## Use as a template

This repository can be used as a template. Use GitHub's **Use this template**
action, then update plugin metadata, the i18n namespace, route paths, CSS
prefix, and Helm values.

## Check

Run `make help` to list the targets. `make check` runs linting, unit tests,
Quick Start validation, and the plugin build. `yarn lint` applies fixes, so
`make lint` and `make check` can change files. Run `yarn i18n` after changing
translated strings.

`yarn validate:quickstarts` lints the chart and checks the rendered resources
against the card registry and Helm switches: required Quick Start fields, task
reviews and summaries, YAML types and duplicate keys, the shared naming
convention, and each card's `topic` and `durationMinutes`. It renders defaults,
all enabled, each demo disabled in turn, and all disabled; disabling one demo
must not change another. New templates and cards are discovered
automatically, and failures name the file or resource and the field or
rendering scenario.

These checks run without a cluster. They do not execute embedded commands,
verify external links, or prove that a demo works on a particular
OpenShift release; verify that in a Console. Console markers such as
`{{execute}}` and `{{copy}}` are valid rendered content and are preserved.

## Deploy

```sh
make release IMAGE=quay.io/your-namespace/console-demos-ocp-virtualization:latest
```

`release` runs `build`, `push`, and `deploy` in order. Each target is also
available on its own, and `build-push` combines the first two. `deploy` runs
`helm upgrade --install` with `--take-ownership`, so existing `ConsoleQuickStart`
and related objects without Helm annotations are adopted into the release.

![Deploy flow: make release builds and pushes the image and runs helm upgrade; make deploy-pr checks out the pull request first. The chart creates the ConsolePlugin, a Job that enables the plugin, the ConsoleQuickStart resources, and the Deployment and Service that the Console loads the plugin from.](docs/images/deploy-flow.svg)

<details>
<summary>Diagram source</summary>

```mermaid
flowchart LR
    dev([Developer])
    dev -->|"make deploy-pr PR=n IMAGE_REGISTRY=r"| checkout["gh pr checkout<br/>make checkout-pr PR=n<br/>requires a clean working tree"]
    dev -->|"make release IMAGE=i"| build
    checkout --> build["Container build<br/>podman by default<br/>--platform linux/amd64"]
    build --> push["Container push<br/>engine logged in to the registry"]
    push --> registry[("Image registry<br/>IMAGE=#lt;registry#gt;/#lt;name#gt;:#lt;tag#gt;<br/>deploy-pr: pr-N-quickstart:latest")]
    push --> helm["helm upgrade --install<br/>--take-ownership<br/>--set-string plugin.image"]
    subgraph cluster["OpenShift cluster, one namespace"]
        plugin["ConsolePlugin<br/>backend: the Service, port 9443<br/>fixed cluster-scoped name"]
        job["Job, post-install and post-upgrade hook<br/>oc patch consoles.operator.openshift.io cluster spec.plugins<br/>adds the plugin name to the list"]
        quickstarts[("ConsoleQuickStart resources<br/>one per enabled values entry<br/>quickStarts.#lt;name#gt;.enabled<br/>cluster scoped")]
        workload["Deployment and Service<br/>nginx serves dist/ over TLS, port 9443<br/>serving cert via Service annotation"]
    end
    helm --> cluster
    registry -.->|"image pull"| workload
    plugin -.->|"loaded once the Job enables it"| console["OpenShift Console<br/>loads the plugin from the Service"]
    %% Namespace and release name are console-demos-ocp-virtualization by default; NAMESPACE and RELEASE override them
    %% deploy-pr requires a clean working tree and leaves the tree on the PR branch
    %% Image name: deploy-pr pushes IMAGE_REGISTRY/pr-N-quickstart:latest; set IMAGE to override it
    %% Helm 3.17 or newer is required for --take-ownership
    %% Registry: the container engine must be logged in to the registry, and the cluster must be able to pull the image
    %% ConsolePlugin has a fixed cluster-scoped name, so a second release cannot adopt it
```

</details>

| Variable             | Default                                                                            | Used by                                                                    |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `IMAGE`              | `<IMAGE_REGISTRY>/pr-<PR>-quickstart:latest` when both are set; otherwise required | `build`, `push`, `deploy`, `release`, `deploy-pr`                          |
| `IMAGE_REGISTRY`     | empty                                                                              | `deploy-pr`, to derive `IMAGE`                                             |
| `PR`                 | empty                                                                              | `checkout-pr`, `deploy-pr`                                                 |
| `PLATFORM`           | `linux/amd64`                                                                      | `build`; keep the default when building for amd64 nodes from Apple Silicon |
| `CONTAINER_ENGINE`   | `podman`                                                                           | `build`, `push`; set `docker` to use Docker                                |
| `RELEASE`            | `console-demos-ocp-virtualization`                                                 | `deploy`                                                                   |
| `NAMESPACE`          | `console-demos-ocp-virtualization`                                                 | `deploy`; created if missing                                               |
| `CHART`              | `charts/console-demos-ocp-virtualization`                                          | `deploy`                                                                   |
| `KUBE_CONTEXT`       | current kubeconfig context                                                         | `deploy`, as `--kube-context`                                              |
| `HELM`, `GH`, `YARN` | `helm`, `gh`, the checked-in Yarn release                                          | `deploy`; `checkout-pr`; `install`                                         |

Cluster-scoped chart resources such as the `ConsolePlugin` keep the fixed name
`console-demos-ocp-virtualization`, so a second release cannot adopt them.
Override `RELEASE` or `NAMESPACE` only when intentionally replacing a
non-default install.

Set `plugin.quickStarts.<name>.enabled=false` to omit one demo's
`ConsoleQuickStart` resource. [`values.yaml`](charts/console-demos-ocp-virtualization/values.yaml)
lists every switch.

### Deploy a pull request to a test cluster

```sh
make deploy-pr PR=50 IMAGE_REGISTRY=quay.io/your-namespace
```

Preconditions:

- A clean working tree.
- The GitHub CLI (`gh`), authenticated.
- The container engine logged in to the registry.
- A cluster that can pull the image. Helm uses the current kubeconfig context
  unless `KUBE_CONTEXT` is set.

The target:

1. Checks out the pull request with `gh pr checkout`.
2. Builds and pushes `quay.io/your-namespace/pr-50-quickstart:latest`.
3. Upgrades the default release and namespace with `--take-ownership`.
4. Leaves the working tree on the pull request branch.

Set `IMAGE` to a full image reference to override the generated name.
Reviewers can check out a pull request without deploying with
`make checkout-pr PR=<number>`; it needs `gh` and a clean working tree.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers the change workflow, commit sign-off,
and the pull request checks.

## Diagram sources

The diagrams under `docs/images/` are hand-written SVGs built to
[docs/images/SVG-STYLE.md](docs/images/SVG-STYLE.md). The Mermaid source of
each figure is in the collapsed block under it.
