package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.util.List;

/**
 * A run or a step named a model that has no active tariff. Such a model is never offered and never
 * charged; the caller must pick a priced one. Mapped to HTTP 422 with the {@code unpriced-model}
 * problem type.
 */
public class UnpricedModelException extends DomainException {

    private final String provider;
    private final String modelId;

    public UnpricedModelException(final String provider, final String modelId) {
        super(
                "No active tariff prices %s/%s".formatted(provider, modelId),
                List.of(new Error("modelId", "No active tariff prices %s/%s".formatted(provider, modelId))));
        this.provider = provider;
        this.modelId = modelId;
    }

    public String provider() {
        return provider;
    }

    public String modelId() {
        return modelId;
    }
}
