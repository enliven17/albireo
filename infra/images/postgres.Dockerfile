FROM golang:1.27.4-alpine@sha256:0a5f7fe796599ff487605987432e7619ae45beeb2fba4c2ce0b907879932aebf AS helper
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
# gosu 1.20, immutable upstream revision; preserve the privilege-drop boundary.
WORKDIR /build
RUN go mod init stellarcope.local/gosu-build \
    && go get github.com/tianon/gosu@v0.0.0-20261025094355-29b939aa5bd4 golang.org/x/sys@v0.44.0 \
    && go build -trimpath -ldflags='-s -w' -o /go/bin/gosu github.com/tianon/gosu

FROM postgres:17.12-alpine@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7
COPY --from=helper /go/bin/gosu /usr/local/bin/gosu
