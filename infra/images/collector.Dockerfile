FROM golang:1.27.4-alpine@sha256:0a5f7fe796599ff487605987432e7619ae45beeb2fba4c2ce0b907879932aebf AS build
ENV CGO_ENABLED=0 GOMAXPROCS=2 GOFLAGS=-p=2 GOTOOLCHAIN=local
RUN go install go.opentelemetry.io/collector/cmd/builder@v0.165.0
COPY infra/images/collector.yaml /build/manifest.yaml
RUN /go/bin/builder --config=/build/manifest.yaml --skip-compilation
WORKDIR /build/collector
# The official distribution predates the patched Go runtime and x/crypto release.
RUN go get golang.org/x/crypto@v0.59.0 && go mod tidy \
    && go build -trimpath -tags grpcnotrace -ldflags='-s -w' -o /otelcol-contrib .

FROM scratch AS base
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /otelcol-contrib /otelcol-contrib
USER 10001:10001
ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config=/etc/otelcol-contrib/config.yaml"]

FROM base AS stack
COPY experiments/stack/synchronous.yaml /etc/otelcol-contrib/config.yaml

FROM base AS reliability
COPY experiments/reliability/*.yaml /lab/
COPY experiments/reliability/generated/*.yaml /lab/
