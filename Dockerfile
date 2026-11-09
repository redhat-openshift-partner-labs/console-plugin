# Build browser assets on the builder's native CPU; only the nginx image needs the target CPU.
ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM registry.access.redhat.com/ubi9/nodejs-24:latest AS build
USER root

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /usr/src/app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases

RUN LOCAL_YARN="node $(awk '/yarnPath:/{print $2}' .yarnrc.yml)" && \
    $LOCAL_YARN install --immutable

COPY console-extensions.json webpack.config.ts tsconfig.json .swcrc ./
COPY src ./src
COPY locales ./locales

RUN LOCAL_YARN="node $(awk '/yarnPath:/{print $2}' .yarnrc.yml)" && \
    $LOCAL_YARN build

FROM registry.access.redhat.com/ubi9/nginx-120:latest

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;"]
