# Stage 1: Build
FROM golang:1.22-alpine AS builder

WORKDIR /build

COPY go.mod ./
RUN go mod download || true

COPY . .
RUN go mod tidy && go build -o /app/server ./cmd/api

# Stage 2: Runtime
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/server /app/server
COPY --from=builder /build/migrations /app/migrations

WORKDIR /app
EXPOSE 8080

CMD ["/app/server"]
