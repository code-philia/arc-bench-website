FROM mcr.microsoft.com/playwright/python:v1.54.0-noble

WORKDIR /opt/arcbench

ENV NPM_CONFIG_REGISTRY=https://repo.huaweicloud.com/repository/npm/ \
    NPM_CONFIG_REPLACE_REGISTRY_HOST=npmjs

RUN sed -i 's|http://archive.ubuntu.com/ubuntu|https://mirrors.aliyun.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl ca-certificates xz-utils \
    && curl -fsSL https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-x64.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz \
    && npm config set registry "${NPM_CONFIG_REGISTRY}" \
    && npm config set replace-registry-host "${NPM_CONFIG_REPLACE_REGISTRY_HOST}" \
    && node --version \
    && npm --version \
    && rm -rf /var/lib/apt/lists/*

COPY run_submission.py /opt/arcbench/run_submission.py

ENTRYPOINT ["python3", "/opt/arcbench/run_submission.py"]
