package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.credits.ListModelTariffs;
import java.util.List;

/** The published rate card. Same model objects as the wallet view, without {@code affordable}. */
public record TariffsResponse(List<TariffsResponse.Model> models) {

    public record Model(
            String provider,
            String modelId,
            int tariffVersion,
            long inputPerMillion,
            long cachedInputPerMillion,
            long outputPerMillion,
            long minimumCharge) {}

    public static TariffsResponse from(final ListModelTariffs.Output output) {
        return new TariffsResponse(output.models().stream()
                .map(tariff -> new Model(
                        tariff.provider(),
                        tariff.modelId(),
                        tariff.version(),
                        tariff.inputPerMillion().micros(),
                        tariff.cachedInputPerMillion().micros(),
                        tariff.outputPerMillion().micros(),
                        tariff.minimumCharge().micros()))
                .toList());
    }
}
