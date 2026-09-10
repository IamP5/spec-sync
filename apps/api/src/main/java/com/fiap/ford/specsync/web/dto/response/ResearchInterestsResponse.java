package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.research.ListResearchInterests;
import com.fiap.ford.specsync.application.research.SaveResearchInterest;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
import java.util.List;

public record ResearchInterestsResponse(
        List<ResearchInterestGateway.Person> people, ResearchInterestGateway.Person mine, boolean hasMore) {
    private static ResearchInterestsResponse from(ResearchInterestGateway.Page page) {
        return new ResearchInterestsResponse(page.people(), page.mine(), page.hasMore());
    }

    public static ResearchInterestsResponse from(ListResearchInterests.Output output) {
        return from(output.result());
    }

    public static ResearchInterestsResponse from(SaveResearchInterest.Output output) {
        return from(output.result());
    }
}
