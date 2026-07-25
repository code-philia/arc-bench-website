FROM mcr.microsoft.com/playwright/python:v1.54.0-noble

WORKDIR /opt/arcbench

ENV NPM_CONFIG_REGISTRY=https://repo.huaweicloud.com/repository/npm/ \
    NPM_CONFIG_REPLACE_REGISTRY_HOST=npmjs \
    CARGO_NET_GIT_FETCH_WITH_CLI=true \
    PATH=/root/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN sed -i 's|http://archive.ubuntu.com/ubuntu|https://mirrors.aliyun.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl ca-certificates xz-utils pkg-config libssl-dev git \
    && curl -fsSL https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-x64.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
    && npm config set registry "${NPM_CONFIG_REGISTRY}" \
    && npm config set replace-registry-host "${NPM_CONFIG_REPLACE_REGISTRY_HOST}" \
    && node --version \
    && npm --version \
    && rustc --version \
    && cargo --version \
    && rm -rf /var/lib/apt/lists/*

COPY octos /opt/octos-src
COPY packages/skills /opt/arcbench/skills

RUN cargo install --path /opt/octos-src/crates/octos-cli

RUN octos skills install ./skills/arcbench-traceability --force \
    && octos skills install ./skills/arcbench-runtime-signals --force \
    && octos skills install ./skills/arcbench-checkpoint --force

COPY backend/runner/octos-runner/run_octos_submission.py /opt/arcbench/run_octos_submission.py

ENTRYPOINT ["python3", "/opt/arcbench/run_octos_submission.py"]
