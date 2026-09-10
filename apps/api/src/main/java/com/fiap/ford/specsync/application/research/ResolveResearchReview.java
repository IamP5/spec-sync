package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import java.util.UUID;

/** Resolves a user's active subscription before granting access to shared review evidence. */
public abstract class ResolveResearchReview extends UseCase<ResolveResearchReview.Input, ResolveResearchReview.Output> {
    public record Input(UUID id, String uid) {}

    public interface Output {
        UUID workId();
    }
}
