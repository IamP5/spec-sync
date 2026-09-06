package com.fiap.ford.specsync.domain.knowledge;

public interface KnowledgeGateway {
    KnowledgeResult retrieve(KnowledgeQuery query);
}
