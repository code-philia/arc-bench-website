FROM mcr.microsoft.com/playwright/python:v1.54.0-jammy

WORKDIR /opt/arcbench

COPY run_submission.py /opt/arcbench/run_submission.py

RUN useradd -m -u 1000 runner

USER runner

ENTRYPOINT ["python3", "/opt/arcbench/run_submission.py"]
