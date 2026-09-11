package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.request.SaveResearchCheckpointRequest;
import com.fiap.ford.specsync.web.dto.response.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Research worker checkpoints")
@RequestMapping(value = "/api/internal/research/works/{workId}/attempts/{attemptId}", produces = "application/json")
public interface ResearchAttemptApi {
    @PostMapping("/heartbeat")
    @Operation(summary = "Renew the current unexpired processing lease")
    ResearchAttemptResponse heartbeat(@PathVariable UUID workId, @PathVariable UUID attemptId);

    @GetMapping("/checkpoints")
    @Operation(summary = "Read immutable checkpoints of the current attempt's work")
    ResearchCheckpointsResponse checkpoints(@PathVariable UUID workId, @PathVariable UUID attemptId);

    @PutMapping("/checkpoints/{key}")
    @Operation(summary = "Save an immutable checkpoint while holding the current lease")
    ResearchAttemptResponse checkpoint(
            @PathVariable UUID workId,
            @PathVariable UUID attemptId,
            @PathVariable String key,
            @Valid @RequestBody SaveResearchCheckpointRequest input);
}
