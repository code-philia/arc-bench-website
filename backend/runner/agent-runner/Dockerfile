FROM mcr.microsoft.com/playwright/python:v1.54.0-noble

WORKDIR /opt/arcbench

COPY arc_agent-0.1.0-py3-none-any.whl /tmp/arc_agent-0.1.0-py3-none-any.whl

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl ca-certificates xz-utils \
    && curl -fsSL https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-x64.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz \
    && python3 -m pip install --no-cache-dir /tmp/arc_agent-0.1.0-py3-none-any.whl \
    && rm -f /tmp/arc_agent-0.1.0-py3-none-any.whl \
    && node --version \
    && npm --version \
    && rm -rf /var/lib/apt/lists/*

COPY run_submission.py /opt/arcbench/run_submission.py

ENTRYPOINT ["python3", "/opt/arcbench/run_submission.py"]
