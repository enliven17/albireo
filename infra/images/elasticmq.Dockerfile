FROM softwaremill/elasticmq-native:1.7.1@sha256:e4580ab9ad1bd5cd37b4ba04911bc5ccc8cd2d9ab4de56ece65acee71c24e05c
# Test emulator: retain its SQS binary/API and refresh its linked OS libraries.
RUN apk upgrade --no-cache
