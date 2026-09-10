package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.research.*;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.web.api.ResearchAttemptApi;
import com.fiap.ford.specsync.web.dto.request.SaveResearchCheckpointRequest;
import com.fiap.ford.specsync.web.dto.response.*;
import java.util.*;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ResearchAttemptController implements ResearchAttemptApi {
    private final HeartbeatResearch heartbeat;
    private final ListResearchCheckpoints checkpoints;
    private final SaveResearchCheckpoint checkpoint;

    public ResearchAttemptController(
            HeartbeatResearch heartbeat, ListResearchCheckpoints checkpoints, SaveResearchCheckpoint checkpoint) {
        this.heartbeat = Objects.requireNonNull(heartbeat);
        this.checkpoints = Objects.requireNonNull(checkpoints);
        this.checkpoint = Objects.requireNonNull(checkpoint);
    }

    @Override
    public ResearchAttemptResponse heartbeat(UUID workId, UUID attemptId) {
        heartbeat.execute(new HeartbeatResearch.Input(workId, attemptId));
        return new ResearchAttemptResponse(true);
    }

    @Override
    public ResearchCheckpointsResponse checkpoints(UUID workId, UUID attemptId) {
        return checkpoints.execute(
                new ListResearchCheckpoints.Input(workId, attemptId),
                output -> new ResearchCheckpointsResponse(output.result()));
    }

    @Override
    public ResearchAttemptResponse checkpoint(
            UUID workId, UUID attemptId, String key, SaveResearchCheckpointRequest input) {
        checkpoint.execute(
                new SaveResearchCheckpoint.Input(workId, attemptId, new Research.Checkpoint(key, input.payload())));
        return new ResearchAttemptResponse(true);
    }
}
