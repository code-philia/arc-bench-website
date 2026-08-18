FROM mcr.microsoft.com/playwright/python:v1.54.0-noble

ARG ARCBENCH_PIP_INDEX_URL=https://repo.huaweicloud.com/repository/pypi/simple
ARG ARCBENCH_PIP_TRUSTED_HOST=repo.huaweicloud.com

WORKDIR /opt/arcbench

ENV NPM_CONFIG_REGISTRY=https://repo.huaweicloud.com/repository/npm/ \
    NPM_CONFIG_REPLACE_REGISTRY_HOST=npmjs \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PIP_INDEX_URL=${ARCBENCH_PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${ARCBENCH_PIP_TRUSTED_HOST} \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
        xz-utils \
        pkg-config \
        libssl-dev \
        git \
        lsof \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL \
        https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-x64.tar.xz \
        -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz \
    && node --version \
    && npm --version

# Configure npm mirror and install Playwright JS package
RUN npm config set registry "${NPM_CONFIG_REGISTRY}" \
    && npm config set replace-registry-host "${NPM_CONFIG_REPLACE_REGISTRY_HOST}" \
    && npm install \
        --prefix /opt/arcbench \
        --no-audit \
        --no-fund \
        --ignore-scripts \
        @playwright/test@1.54.0

# Preinstall common Python packages
RUN python3 -m pip install \
        --no-cache-dir \
        --prefer-binary \
        playwright==1.54.0 \
        openai-codex \
        openai \
        anthropic \
        pydantic \
        PyYAML \
        httpx \
        requests \
        python-dotenv \
        tenacity \
        rich \
        jsonschema \
        jinja2 \
        setuptools \
        wheel \
        packaging \
    && python3 --version \
    && python3 -m pip --version \
    && git --version

COPY packages/shared/skills /opt/arcbench/skills

COPY backend/runner/agent-runner/run_submission.py /opt/arcbench/run_submission.py
COPY backend/runner/agent-runner/smoke_test.py /opt/arcbench/smoke_test.py

CMD ["python3", "/opt/arcbench/run_submission.py"]