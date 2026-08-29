#!/usr/bin/env bash
# Copy to source.sh, replace values, then run: source ./source.sh

export ARCBENCH_DATABASE_URL='postgresql+psycopg://arcbench:URL_ENCODED_PASSWORD@127.0.0.1:5432/arcbench?sslmode=prefer'
export ARCBENCH_REDIS_URL='redis://:URL_ENCODED_REDIS_PASSWORD@127.0.0.1:6379/0'
export ARCBENCH_SESSION_SECRET='CHANGE_ME_LONG_RANDOM_SESSION_SECRET'
export ARCBENCH_SECURE_COOKIES='false'
export ARCBENCH_CORS_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]'

export ARCBENCH_WORKER_SOFT_TIME_LIMIT_SECONDS='1900'
export ARCBENCH_WORKER_HARD_TIME_LIMIT_SECONDS='2000'
export ARCBENCH_MAX_CONCURRENT_RUNS='4'
export ARCBENCH_RUNNER_IMAGE='arcbench-runner:local'
export ARCBENCH_RUNNER_BUILD_ON_DEMAND='true'
export ARCBENCH_RUNNER_CPU_LIMIT='2'
export ARCBENCH_RUNNER_MEMORY_LIMIT='4g'
export ARCBENCH_RUNNER_TIMEOUT_SECONDS='0'
export ARCBENCH_AGENT_HEALTH_TIMEOUT_SECONDS='90'

export ARCBENCH_PIP_INDEX_URL='https://pypi.tuna.tsinghua.edu.cn/simple'
export ARCBENCH_PIP_TRUSTED_HOST='pypi.tuna.tsinghua.edu.cn'
export ARCBENCH_PIP_EXTRA_INDEX_URL='https://pypi.org/simple'
export ARCBENCH_RUNNER_DNS_SERVERS='223.5.5.5,1.1.1.1'

echo 'ARC-Bench environment loaded.'
