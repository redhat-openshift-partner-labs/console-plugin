YARN ?= node .yarn/releases/yarn-4.18.0.cjs
HELM ?= helm
GH ?= gh
CONTAINER_ENGINE ?= podman

IMAGE_REGISTRY ?=
IMAGE ?= $(if $(and $(strip $(IMAGE_REGISTRY)),$(strip $(PR))),$(patsubst %/,%,$(IMAGE_REGISTRY))/pr-$(PR)-quickstart:latest)
PLATFORM ?= linux/amd64
RELEASE ?= partner-labs-console-plugin
NAMESPACE ?= partner-labs-console-plugin
CHART ?= charts/partner-labs-console-plugin
KUBE_CONTEXT ?=
PR ?=

help: ## List available targets
	@awk 'BEGIN { FS = ":.*##" } /^[a-zA-Z0-9_-]+:.*##/ { printf "  make %-22s %s\n", $$1, $$2 }' Makefile
	@printf '\nVariables:\n'
	@printf '%s\n' '  IMAGE=<registry>/<image>:<tag>  Optional full image override for container targets.'
	@printf '%s\n' '  IMAGE_REGISTRY=<registry>/<namespace>  Registry prefix for PR images (for example, quay.io/your-namespace).'
	@printf '%s\n' '  PLATFORM=...                     Defaults to linux/amd64; override to choose another build platform.'
	@printf '%s\n' '  CONTAINER_ENGINE=...              Defaults to podman; set to docker to use Docker.'
	@printf '%s\n' '  RELEASE=... NAMESPACE=...        Helm release and namespace (defaults to partner-labs-console-plugin).'
	@printf '%s\n' '  CHART=... KUBE_CONTEXT=...        Chart path and optional Helm context override.'
	@printf '%s\n' '  PR=<number>                      Required by checkout-pr and deploy-pr.'
	@printf '%s\n' '  YARN=... HELM=... GH=...          Optional overrides for the corresponding CLI commands.'
	@printf '\nPrerequisites:\n'
	@printf '%s\n' '  Yarn for install; installed dependencies for check/test/build-plugin; Helm for Quick Start validation and deploy; Docker or Podman for image targets; gh and a clean tree for PR checkout/deploy.'

.PHONY: help install build-plugin build push build-push deploy release checkout-pr deploy-pr lint test check check-image check-pr check-pr-deploy

install: ## Install dependencies using the checked-in Yarn release and lockfile locally
	$(YARN) install --immutable

build-plugin: ## Build the plugin assets with Webpack locally
	$(YARN) build

check-image:
	@if [ -z "$(IMAGE)" ]; then \
		printf '%s\n' 'Set IMAGE=<registry>/<image>:<tag>, or set IMAGE_REGISTRY and PR to derive the PR image.' >&2; \
		exit 2; \
	fi

build: check-image ## Build the container image; default platform is linux/amd64
	@if [ -n "$(PLATFORM)" ]; then \
		"$(CONTAINER_ENGINE)" build --platform "$(PLATFORM)" -t "$(IMAGE)" .; \
	else \
		"$(CONTAINER_ENGINE)" build -t "$(IMAGE)" .; \
	fi

push: check-image ## Push IMAGE to its registry
	"$(CONTAINER_ENGINE)" push "$(IMAGE)"

build-push: check-image ## Build and push IMAGE in order
	@$(MAKE) build
	@$(MAKE) push

deploy: check-image ## Install or upgrade the Helm release with IMAGE
	@if [ -n "$(KUBE_CONTEXT)" ]; then \
		"$(HELM)" upgrade --install "$(RELEASE)" "$(CHART)" \
			--namespace "$(NAMESPACE)" --create-namespace \
			--set-string "plugin.image=$(IMAGE)" \
			--kube-context "$(KUBE_CONTEXT)"; \
	else \
		"$(HELM)" upgrade --install "$(RELEASE)" "$(CHART)" \
			--namespace "$(NAMESPACE)" --create-namespace \
			--set-string "plugin.image=$(IMAGE)"; \
	fi

release: check-image ## Build, push, then deploy IMAGE to the selected cluster
	@$(MAKE) build
	@$(MAKE) push
	@$(MAKE) deploy

check-pr:
	@if [ -z "$(PR)" ]; then \
		printf '%s\n' 'Set PR=<number> (for example, make deploy-pr PR=50 IMAGE_REGISTRY=quay.io/your-namespace).' >&2; \
		exit 2; \
	fi
	@command -v "$(GH)" >/dev/null 2>&1 || { printf '%s\n' 'GitHub CLI (gh) is required.' >&2; exit 2; }
	@if [ -n "$$(git status --porcelain)" ]; then \
		printf '%s\n' 'The working tree is not clean; commit or stash changes before checking out a PR.' >&2; \
		exit 2; \
	fi

checkout-pr: check-pr ## Check out a PR using the GitHub CLI (requires a clean tree)
	"$(GH)" pr checkout "$(PR)"

check-pr-deploy: check-pr check-image
	@command -v "$(CONTAINER_ENGINE)" >/dev/null 2>&1 || { printf 'Container engine %s is required.\n' "$(CONTAINER_ENGINE)" >&2; exit 2; }
	@command -v "$(HELM)" >/dev/null 2>&1 || { printf 'Helm command %s is required.\n' "$(HELM)" >&2; exit 2; }

deploy-pr: check-pr-deploy ## Check out PR, build and push its image, then deploy using the current kubeconfig context
	@$(MAKE) checkout-pr PR="$(PR)"
	@$(MAKE) release IMAGE="$(IMAGE)" \
		KUBE_CONTEXT="$(KUBE_CONTEXT)" \
		RELEASE="pr-$(PR)-quickstart" \
		NAMESPACE="pr-$(PR)-quickstart"

lint: ## Run the repository lint scripts (yarn lint applies fixes)
	$(YARN) lint

test: ## Run unit tests and Quick Start validation
	$(YARN) test --ci --runInBand
	$(YARN) validate:quickstarts

check: ## Run lint, tests, Quick Start validation, and the plugin build
	@$(MAKE) lint
	@$(MAKE) test
	@$(MAKE) build-plugin
