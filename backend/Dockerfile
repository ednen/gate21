# Build context is the repository root (the API bundles ../content).
#   docker build -f backend/Dockerfile -t gate21-api .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml backend/pom.xml
RUN mvn -B -q -f backend/pom.xml dependency:go-offline
COPY content content
COPY backend/src backend/src
RUN mvn -B -q -f backend/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre-alpine
# ffmpeg converts Android's AAC recordings to WAV for Azure (in memory, via pipes).
RUN apk add --no-cache ffmpeg && addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --from=build /src/backend/target/gate21-backend-*.jar app.jar
# 8080 = API, 8081 = actuator (health, prometheus) for the internal network only
EXPOSE 8080 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
