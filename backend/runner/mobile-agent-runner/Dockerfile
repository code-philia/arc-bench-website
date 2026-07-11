FROM budtmo/docker-android:emulator_12.0

ENV DEBIAN_FRONTEND=noninteractive
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV ANDROID_HOME=/opt/android
ENV ANDROID_SDK_ROOT=/opt/android
ENV GRADLE_USER_HOME=/opt/gradle-home
USER root

COPY backend/runner/mobile-agent-runner/arc_agent-0.1.0-py3-none-any.whl /tmp/arc_agent-0.1.0-py3-none-any.whl
COPY arc-bench/mobileapp/template /tmp/mobile-template

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        openjdk-17-jdk \
        python3 \
        python3-pip \
        python3-venv \
        unzip \
    && python3 -m pip install --break-system-packages --no-cache-dir \
        /tmp/arc_agent-0.1.0-py3-none-any.whl \
        uiautomator2 \
    && python3 -m uiautomator2 init \
    && mkdir -p "${GRADLE_USER_HOME}" \
    && chmod +x /tmp/mobile-template/gradlew \
    && (cd /tmp/mobile-template && ./gradlew --no-daemon assembleDebug) \
    && rm -f /tmp/arc_agent-0.1.0-py3-none-any.whl \
    && rm -rf /tmp/mobile-template \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/arcbench

COPY backend/runner/mobile-agent-runner/entrypoint.sh /opt/arcbench/entrypoint.sh
COPY backend/runner/mobile-agent-runner/run_submission.py /opt/arcbench/run_submission.py

RUN chmod +x /opt/arcbench/entrypoint.sh

ENTRYPOINT ["/opt/arcbench/entrypoint.sh"]
CMD ["python3", "/opt/arcbench/run_submission.py"]
