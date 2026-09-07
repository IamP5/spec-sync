package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.credits.FinishCreditRun;
import com.fiap.ford.specsync.application.credits.GetWallet;
import com.fiap.ford.specsync.application.credits.ListModelTariffs;
import com.fiap.ford.specsync.application.credits.RecordCreditUsage;
import com.fiap.ford.specsync.application.credits.StartCreditRun;
import com.fiap.ford.specsync.web.api.AiCreditsApi;
import com.fiap.ford.specsync.web.dto.request.FinishCreditRunRequest;
import com.fiap.ford.specsync.web.dto.request.RecordCreditUsageRequest;
import com.fiap.ford.specsync.web.dto.request.StartCreditRunRequest;
import com.fiap.ford.specsync.web.dto.response.CreditRunResponse;
import com.fiap.ford.specsync.web.dto.response.CreditUsageResponse;
import com.fiap.ford.specsync.web.dto.response.TariffsResponse;
import com.fiap.ford.specsync.web.dto.response.WalletResponse;
import java.util.Objects;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiCreditsController implements AiCreditsApi {

    private final GetWallet getWallet;
    private final ListModelTariffs listModelTariffs;
    private final StartCreditRun startCreditRun;
    private final RecordCreditUsage recordCreditUsage;
    private final FinishCreditRun finishCreditRun;

    public AiCreditsController(
            final GetWallet getWallet,
            final ListModelTariffs listModelTariffs,
            final StartCreditRun startCreditRun,
            final RecordCreditUsage recordCreditUsage,
            final FinishCreditRun finishCreditRun) {
        this.getWallet = Objects.requireNonNull(getWallet);
        this.listModelTariffs = Objects.requireNonNull(listModelTariffs);
        this.startCreditRun = Objects.requireNonNull(startCreditRun);
        this.recordCreditUsage = Objects.requireNonNull(recordCreditUsage);
        this.finishCreditRun = Objects.requireNonNull(finishCreditRun);
    }

    @Override
    public WalletResponse wallet(final String uid) {
        return getWallet.execute(new GetWallet.Input(uid), WalletResponse::from);
    }

    @Override
    public TariffsResponse tariffs() {
        return listModelTariffs.execute(TariffsResponse::from);
    }

    @Override
    public CreditRunResponse startRun(final String uid, final StartCreditRunRequest request) {
        return startCreditRun.execute(
                new StartCreditRun.Input(
                        uid, request.runId(), request.provider(), request.modelId(), request.threadId()),
                CreditRunResponse::from);
    }

    @Override
    public CreditUsageResponse recordUsage(
            final String uid, final String runId, final RecordCreditUsageRequest request) {
        return recordCreditUsage.execute(
                new RecordCreditUsage.Input(
                        uid,
                        runId,
                        request.stepKey(),
                        request.provider(),
                        request.modelId(),
                        request.inputTokens(),
                        request.cachedInputTokens(),
                        request.outputTokens(),
                        request.reasoningTokens(),
                        request.estimated()),
                CreditUsageResponse::from);
    }

    @Override
    public WalletResponse finishRun(final String uid, final String runId, final FinishCreditRunRequest request) {
        return finishCreditRun.execute(new FinishCreditRun.Input(uid, runId, request.status()), WalletResponse::from);
    }
}
