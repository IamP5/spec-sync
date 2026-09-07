package com.fiap.ford.specsync.application.credits;

import com.fiap.ford.specsync.application.NullaryUseCase;
import com.fiap.ford.specsync.domain.credits.Credits;
import java.util.List;

/** Lists the published rate card. The AI service hides unpriced models from its catalog with it. */
public abstract class ListModelTariffs extends NullaryUseCase<ListModelTariffs.Output> {

    public interface Output {

        List<Credits.ModelTariff> models();
    }
}
