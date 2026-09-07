package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("specsync.cloud-run")
public record CloudRunProperties(boolean enabled) {}
