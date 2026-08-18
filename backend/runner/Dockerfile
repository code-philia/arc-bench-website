FROM mcr.microsoft.com/playwright/python:v1.54.0-noble

ARG ARCBENCH_PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG ARCBENCH_PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

WORKDIR /opt/arcbench

ENV NPM_CONFIG_REGISTRY=https://repo.huaweicloud.com/repository/npm/ \
    NPM_CONFIG_REPLACE_REGISTRY_HOST=npmjs \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PIP_INDEX_URL=${ARCBENCH_PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${ARCBENCH_PIP_TRUSTED_HOST} \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN sed -i 's|http://archive.ubuntu.com/ubuntu|https://mirrors.aliyun.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
        xz-utils \
        pkg-config \
        libssl-dev \
        git \
        lsof \
    && curl -fsSL https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-x64.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz \
    && npm config set registry "${NPM_CONFIG_REGISTRY}" \
    && npm config set replace-registry-host "${NPM_CONFIG_REPLACE_REGISTRY_HOST}" \
    && npm install --prefix /opt/arcbench --no-audit --no-fund --ignore-scripts @playwright/test@1.54.0 \
    && python3 -m pip install --no-cache-dir playwright==1.54.0 \
    && node --version \
    && npm --version \
    && python3 --version \
    && git --version \
    && rm -rf /var/lib/apt/lists/*

COPY packages/shared/skills /opt/arcbench/skills

COPY backend/runner/agent-runner/run_submission.py /opt/arcbench/run_submission.py
COPY backend/runner/agent-runner/smoke_test.py /opt/arcbench/smoke_test.py

CMD ["python3", "/opt/arcbench/run_submission.py"]
