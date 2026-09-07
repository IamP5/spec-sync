package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fiap.ford.specsync.application.credits.FinishCreditRun;
import com.fiap.ford.specsync.application.credits.GetWallet;
import com.fiap.ford.specsync.application.credits.ListModelTariffs;
import com.fiap.ford.specsync.application.credits.RecordCreditUsage;
import com.fiap.ford.specsync.application.credits.StartCreditRun;
import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.CreditRunClosedException;
import com.fiap.ford.specsync.domain.credits.CreditRunNotFoundException;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.InsufficientCreditsException;
import com.fiap.ford.specsync.domain.credits.WalletId;
import com.fiap.ford.specsync.infrastructure.configuration.CreditsConfiguration;
import com.fiap.ford.specsync.infrastructure.configuration.GlobalExceptionHandler;
import com.fiap.ford.specsync.infrastructure.configuration.SecurityConfiguration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Controller slice of the internal wallet API: the use cases are mocked, the service-key filter and
 * the problem mapping are real.
 */
@WebMvcTest(AiCreditsController.class)
@Import({SecurityConfiguration.class, CreditsConfiguration.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = "specsync.credits.service-key=" + AiCreditsControllerWebMvcTest.KEY)
class AiCreditsControllerWebMvcTest {

    /** 48 characters, like the key Terraform generates. */
    static final String KEY = "test-credits-service-key-0123456789abcdefghijklmn";

    private static final Credits.ModelTariff FLASH = new Credits.ModelTariff(
            "vertex",
            "gemini-2.5-flash",
            1,
            CreditAmount.of(1_500_000),
            CreditAmount.of(375_000),
            CreditAmount.of(12_500_000),
            Instant.parse("2026-09-07T00:00:00Z"),
            true);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    private GetWallet getWallet;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    private ListModelTariffs listModelTariffs;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    private StartCreditRun startCreditRun;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    private RecordCreditUsage recordCreditUsage;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    private FinishCreditRun finishCreditRun;

    @Test
    void rejectsARequestWithoutTheServiceKey() throws Exception {
        mockMvc.perform(get("/api/internal/ai-credits/wallets/abc")).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsARequestWithTheWrongServiceKey() throws Exception {
        mockMvc.perform(get("/api/internal/ai-credits/wallets/abc").header("Authorization", "Bearer " + KEY + "x"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsARequestWithoutTheBearerScheme() throws Exception {
        mockMvc.perform(get("/api/internal/ai-credits/wallets/abc").header("Authorization", KEY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsTheWalletViewForTheServiceKey() throws Exception {
        when(getWallet.execute(any(GetWallet.Input.class))).thenReturn(new WalletOutput(wallet(), List.of(FLASH)));

        mockMvc.perform(get("/api/internal/ai-credits/wallets/abc").header("Authorization", "Bearer " + KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uid").value("abc"))
                .andExpect(jsonPath("$.unit").value("CREDITS"))
                .andExpect(jsonPath("$.balance").value(7_320_000L))
                .andExpect(jsonPath("$.available").value(7_320_000L))
                .andExpect(jsonPath("$.granted").value(10_000_000L))
                .andExpect(jsonPath("$.spent").value(2_680_000L))
                .andExpect(jsonPath("$.exhausted").value(false))
                .andExpect(jsonPath("$.models[0].modelId").value("gemini-2.5-flash"))
                .andExpect(jsonPath("$.models[0].tariffVersion").value(1))
                .andExpect(jsonPath("$.models[0].inputPerMillion").value(1_500_000L))
                .andExpect(jsonPath("$.models[0].cachedInputPerMillion").value(375_000L))
                .andExpect(jsonPath("$.models[0].outputPerMillion").value(12_500_000L))
                .andExpect(jsonPath("$.models[0].minimumCharge").value(18_500L))
                .andExpect(jsonPath("$.models[0].affordable").value(true))
                .andExpect(jsonPath("$.recentRuns[0].runId").value("run-1"))
                .andExpect(jsonPath("$.recentRuns[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$.recentRuns[0].charge").value(65_000L));
    }

    @Test
    void returnsTheRateCardWithoutAffordability() throws Exception {
        when(listModelTariffs.execute()).thenReturn(() -> List.of(FLASH));

        mockMvc.perform(get("/api/internal/ai-credits/tariffs").header("Authorization", "Bearer " + KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.models[0].modelId").value("gemini-2.5-flash"))
                .andExpect(jsonPath("$.models[0].minimumCharge").value(18_500L))
                .andExpect(jsonPath("$.models[0].affordable").doesNotExist());
    }

    @Test
    void returnsTheHoldOfAnAdmittedRun() throws Exception {
        when(startCreditRun.execute(any(StartCreditRun.Input.class)))
                .thenReturn(new RunOutput(
                        "run-1",
                        CreditAmount.of(145_000),
                        CreditAmount.of(10_000_000),
                        CreditAmount.of(9_855_000),
                        false));

        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"runId":"run-1","provider":"vertex","modelId":"gemini-2.5-flash","threadId":"t-1"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value("run-1"))
                .andExpect(jsonPath("$.hold").value(145_000L))
                .andExpect(jsonPath("$.available").value(9_855_000L))
                .andExpect(jsonPath("$.exhausted").value(false));
    }

    @Test
    void answersPaymentRequiredWithTheCheaperModelsWhenCreditsDoNotCoverTheRun() throws Exception {
        when(startCreditRun.execute(any(StartCreditRun.Input.class)))
                .thenThrow(new InsufficientCreditsException(
                        CreditAmount.of(20_000),
                        CreditAmount.of(75_000),
                        List.of("gemini-2.5-flash-lite", "gemini-2.5-flash")));

        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"runId\":\"run-1\",\"provider\":\"vertex\",\"modelId\":\"gemini-2.5-pro\"}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_CREDITS"))
                .andExpect(jsonPath("$.available").value(20_000L))
                .andExpect(jsonPath("$.minimumCharge").value(75_000L))
                .andExpect(jsonPath("$.cheaperModels[0]").value("gemini-2.5-flash-lite"))
                .andExpect(jsonPath("$.cheaperModels[1]").value("gemini-2.5-flash"));
    }

    @Test
    void rejectsARunRequestWithoutAModel() throws Exception {
        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"runId\":\"run-1\",\"provider\":\"vertex\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsTheChargeOfAStep() throws Exception {
        when(recordCreditUsage.execute(any(RecordCreditUsage.Input.class)))
                .thenReturn(new UsageOutput(
                        CreditAmount.of(6_500), CreditAmount.of(9_993_500), CreditAmount.of(9_848_500), false));

        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs/run-1/usage")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stepKey":"step-1","provider":"vertex","modelId":"gemini-2.5-flash",
                                 "inputTokens":5120,"cachedInputTokens":0,"outputTokens":640,
                                 "reasoningTokens":200,"estimated":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.charge").value(6_500L))
                .andExpect(jsonPath("$.balance").value(9_993_500L))
                .andExpect(jsonPath("$.exhausted").value(false));
    }

    @Test
    void answersNotFoundForAStepOfAnUnknownRun() throws Exception {
        when(recordCreditUsage.execute(any(RecordCreditUsage.Input.class)))
                .thenThrow(new CreditRunNotFoundException("run-9"));

        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs/run-9/usage")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stepKey":"step-1","provider":"vertex","modelId":"gemini-2.5-flash",
                                 "inputTokens":10,"cachedInputTokens":0,"outputTokens":10,
                                 "reasoningTokens":0,"estimated":false}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void answersConflictForAStepOfAFinishedRun() throws Exception {
        when(recordCreditUsage.execute(any(RecordCreditUsage.Input.class)))
                .thenThrow(new CreditRunClosedException("run-1", Credits.RunStatus.COMPLETED));

        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs/run-1/usage")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"stepKey":"step-1","provider":"vertex","modelId":"gemini-2.5-flash",
                                 "inputTokens":10,"cachedInputTokens":0,"outputTokens":10,
                                 "reasoningTokens":0,"estimated":false}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void returnsTheWalletViewWhenARunFinishes() throws Exception {
        when(finishCreditRun.execute(any(FinishCreditRun.Input.class)))
                .thenReturn(new FinishOutput(wallet(), List.of(FLASH)));

        mockMvc.perform(post("/api/internal/ai-credits/wallets/abc/runs/run-1/finish")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uid").value("abc"))
                .andExpect(jsonPath("$.available").value(7_320_000L));
    }

    private static Credits.Wallet wallet() {
        return new Credits.Wallet(
                new WalletId("abc"),
                CreditAmount.of(7_320_000),
                CreditAmount.ZERO,
                CreditAmount.of(10_000_000),
                CreditAmount.of(2_680_000),
                List.of(new Credits.CreditRun(
                        "run-1",
                        new WalletId("abc"),
                        "thread-1",
                        "vertex",
                        "gemini-2.5-flash",
                        1,
                        Credits.RunStatus.COMPLETED,
                        CreditAmount.ZERO,
                        null,
                        CreditAmount.of(65_000),
                        Instant.parse("2026-09-07T12:00:00Z"),
                        Instant.parse("2026-09-07T12:00:30Z"))));
    }

    private record WalletOutput(Credits.Wallet wallet, List<Credits.ModelTariff> tariffs) implements GetWallet.Output {}

    private record FinishOutput(Credits.Wallet wallet, List<Credits.ModelTariff> tariffs)
            implements FinishCreditRun.Output {}

    private record RunOutput(
            String runId, CreditAmount hold, CreditAmount balance, CreditAmount available, boolean exhausted)
            implements StartCreditRun.Output {}

    private record UsageOutput(CreditAmount charge, CreditAmount balance, CreditAmount available, boolean exhausted)
            implements RecordCreditUsage.Output {}
}
