FROM python:3.11-slim

# PyFlink needs a JVM
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY stream_processor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kafka connector + clients jar (PyFlink's DataStream Kafka connectors need
# the Java jars on the classpath at runtime).
RUN FLINK_HOME=$(python -c "import pyflink, os; print(os.path.dirname(pyflink.__file__))") && \
    mkdir -p "$FLINK_HOME/lib" && \
    wget -q -P "$FLINK_HOME/lib" \
      https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.1.0-1.18/flink-sql-connector-kafka-3.1.0-1.18.jar

# Shared ML package (anomaly model + training script) alongside the job code
COPY ml/ ./ml/
RUN python ml/train.py

COPY stream_processor/ .
ENV ANOMALY_MODEL_PATH=/app/ml/anomaly_model.joblib
CMD ["python", "job.py"]
