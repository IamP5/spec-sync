package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.request.FinishCreditRunRequest;
import com.fiap.ford.specsync.web.dto.request.RecordCreditUsageRequest;
import com.fiap.ford.specsync.web.dto.request.StartCreditRunRequest;
import com.fiap.ford.specsync.web.dto.response.CreditRunResponse;
import com.fiap.ford.specsync.web.dto.response.CreditUsageResponse;
import com.fiap.ford.specsync.web.dto.response.TariffsResponse;
import com.fiap.ford.specsync.web.dto.response.WalletResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * HTTP contract of the AI credits wallet. Internal: the AI service is the only caller and
 * authenticates with the shared service key ({@code CreditsConfiguration}), which is what makes the
 * {@code uid} in the path trustworthy.
 */
@Tag(name = "AI credits (internal)")
@RequestMapping(value = "/api/internal/ai-credits", produces = "application/json")
public interface AiCreditsApi {

    @GetMapping("/wallets/{uid}")
    @Operation(summary = "Read a wallet, creating it and its signup grant on first contact")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Wallet view"),
        @ApiResponse(responseCode = "401", description = "Service key missing or wrong")
    })
    WalletResponse wallet(@PathVariable String uid);

    @GetMapping("/tariffs")
    @Operation(summary = "List the published rate card; unpriced models are not offered")
    TariffsResponse tariffs();

    @PostMapping("/wallets/{uid}/runs")
    @Operation(summary = "Admit one chat turn and reserve its hold; idempotent per run id")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Run admitted or already open"),
        @ApiResponse(responseCode = "402", description = "Credits do not cover a minimum answer on this model"),
        @ApiResponse(responseCode = "422", description = "The model has no active tariff")
    })
    CreditRunResponse startRun(@PathVariable String uid, @Valid @RequestBody StartCreditRunRequest request);

    @PostMapping("/wallets/{uid}/runs/{runId}/usage")
    @Operation(summary = "Charge one step of an open run; idempotent per step key")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Step charged, or the stored charge replayed"),
        @ApiResponse(responseCode = "404", description = "Unknown run"),
        @ApiResponse(responseCode = "409", description = "The run is already finished")
    })
    CreditUsageResponse recordUsage(
            @PathVariable String uid, @PathVariable String runId, @Valid @RequestBody RecordCreditUsageRequest request);

    @PostMapping("/wallets/{uid}/runs/{runId}/finish")
    @Operation(summary = "Close a run, release its hold and return the refreshed wallet; idempotent")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Wallet view"),
        @ApiResponse(responseCode = "404", description = "Unknown run")
    })
    WalletResponse finishRun(
            @PathVariable String uid, @PathVariable String runId, @Valid @RequestBody FinishCreditRunRequest request);
}
