# syntax=docker/dockerfile:1
#
# Spring Boot API for Cloud Run.
#   build   - compiles the boot jar with the Gradle wrapper and splits it into layers
#   runtime - slim JRE, non-root, layered classpath + JDK 25 AOT cache for fast cold starts
#
# Build context: apps/api (see tools/deploy/api.sh and .dockerignore next to this file).

ARG JDK_IMAGE=eclipse-temurin:25-jdk-alpine
ARG JRE_IMAGE=eclipse-temurin:25-jre-alpine

# ---------------------------------------------------------------------------- build
FROM ${JDK_IMAGE} AS build
WORKDIR /src
ENV GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.console=plain -Dorg.gradle.java.installations.auto-download=false"

# Dependency layer: only invalidated when the build definition changes, so day-to-day
# code changes reuse it (from the BuildKit cache mount locally, registry cache in CI).
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --quiet dependencies --configuration runtimeClasspath

COPY src ./src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --quiet bootJar -x test \
    && cp build/libs/*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --destination /layers

# -------------------------------------------------------------------------- runtime
FROM ${JRE_IMAGE} AS runtime
WORKDIR /app

RUN addgroup -S app && adduser -S -u 1001 -G app app

# Serial GC and compact headers: least memory and quickest startup on a 1-vCPU instance.
# MaxRAMPercentage sizes the heap from the Cloud Run memory limit; OOM kills the instance
# so Cloud Run replaces it instead of serving from a broken JVM.
ENV JAVA_OPTS="-XX:+UseSerialGC -XX:+UseCompactObjectHeaders -XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENV PORT=8080

# Layers ordered from least to most volatile so image pushes/pulls only move what changed.
COPY --from=build /layers/dependencies/ ./
COPY --from=build /layers/spring-boot-loader/ ./
COPY --from=build /layers/snapshot-dependencies/ ./
COPY --from=build /layers/application/ ./

# JDK 25 AOT cache (JEP 514/515): a training run boots the Spring context with cloud
# integrations disabled (application-aot.properties), exits on refresh and records the
# loaded/linked classes + profiles. Must run with the same JVM, flags and classpath used at
# runtime, which is why it happens in this stage and reuses JAVA_OPTS.
RUN java $JAVA_OPTS -XX:AOTCacheOutput=app.aot \
      -Dspring.context.exit=onRefresh -Dspring.profiles.active=cloud,aot \
      -jar app.jar \
    && chmod 0444 app.aot

USER app
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -XX:AOTCache=/app/app.aot -jar /app/app.jar"]
