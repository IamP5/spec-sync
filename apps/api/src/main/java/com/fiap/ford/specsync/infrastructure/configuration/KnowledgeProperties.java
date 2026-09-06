package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("specsync.knowledge")
public record KnowledgeProperties(String url, String username, String password, String embeddingModel) {}
