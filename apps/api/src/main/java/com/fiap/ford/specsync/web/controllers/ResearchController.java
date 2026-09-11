package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.ingestion.GetIngestion;
import com.fiap.ford.specsync.application.ingestion.GetIngestionSource;
import com.fiap.ford.specsync.application.ingestion.PublishIngestion;
import com.fiap.ford.specsync.application.research.*;
import com.fiap.ford.specsync.web.api.ResearchApi;
import com.fiap.ford.specsync.web.dto.request.CreateResearchRequest;
import com.fiap.ford.specsync.web.dto.request.PublishIngestionRequest;
import com.fiap.ford.specsync.web.dto.request.ReplayResearchRequest;
import com.fiap.ford.specsync.web.dto.request.SaveResearchInterestRequest;
import com.fiap.ford.specsync.web.dto.response.*;
import java.util.*;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ResearchController implements ResearchApi {
    private final ResolveResearchReview resolveReview;
    private final GetIngestionSource reviewSource;
    private final GetIngestion review;
    private final PublishIngestion publish;
    private final CreateResearch create;
    private final ListResearch list;
    private final GetResearch get;
    private final CancelResearch cancel;
    private final ReplayResearch replay;
    private final ListResearchInterests interests;
    private final SaveResearchInterest saveInterest;

    public ResearchController(
            CreateResearch create,
            ListResearch list,
            GetResearch get,
            CancelResearch cancel,
            ReplayResearch replay,
            ListResearchInterests interests,
            SaveResearchInterest saveInterest,
            GetIngestion review,
            PublishIngestion publish,
            GetIngestionSource reviewSource,
            ResolveResearchReview resolveReview) {
        this.resolveReview = Objects.requireNonNull(resolveReview);
        this.reviewSource = Objects.requireNonNull(reviewSource);
        this.review = Objects.requireNonNull(review);
        this.publish = Objects.requireNonNull(publish);
        this.saveInterest = Objects.requireNonNull(saveInterest);
        this.interests = Objects.requireNonNull(interests);
        this.replay = Objects.requireNonNull(replay);
        this.create = Objects.requireNonNull(create);
        this.list = Objects.requireNonNull(list);
        this.get = Objects.requireNonNull(get);
        this.cancel = Objects.requireNonNull(cancel);
    }

    @Override
    public ResearchResponse create(String uid, CreateResearchRequest input) {
        return create.execute(
                new CreateResearch.Input(input.id(), uid, input.request()),
                output -> ResearchResponse.from(output.result()));
    }

    @Override
    public ResearchListResponse list(String uid) {
        return list.execute(new ListResearch.Input(uid), output -> new ResearchListResponse(output.result()));
    }

    @Override
    public ResearchResponse get(String uid, UUID id) {
        return get.execute(new GetResearch.Input(id, uid), output -> ResearchResponse.from(output.result()));
    }

    private UUID reviewWork(String uid, UUID id) {
        return resolveReview.execute(new ResolveResearchReview.Input(id, uid)).workId();
    }

    @Override
    public IngestionResponse review(String uid, UUID id) {
        return review.execute(
                new GetIngestion.Input(reviewWork(uid, id), "curator"),
                output -> new IngestionResponse(output.result()));
    }

    @Override
    public ResearchSourceResponse reviewSource(String uid, UUID id) {
        return reviewSource.execute(
                new GetIngestionSource.Input(reviewWork(uid, id), "curator"),
                output -> new ResearchSourceResponse(
                        Base64.getEncoder().encodeToString(output.result().bytes()),
                        output.result().mimeType()));
    }

    @Override
    public IngestionResponse publishReview(String uid, UUID id, PublishIngestionRequest input) {
        return publish.execute(
                new PublishIngestion.Input(reviewWork(uid, id), "curator", input.review(), uid),
                output -> new IngestionResponse(output.result()));
    }

    @Override
    public ResearchResponse replay(String uid, UUID id, ReplayResearchRequest input) {
        return replay.execute(
                new ReplayResearch.Input(id, uid, input.id()), output -> ResearchResponse.from(output.result()));
    }

    @Override
    public ResearchInterestsResponse interests(String uid, UUID id) {
        return interests.execute(new ListResearchInterests.Input(id, uid), ResearchInterestsResponse::from);
    }

    @Override
    public ResearchInterestsResponse saveInterest(String uid, UUID id, SaveResearchInterestRequest input) {
        return saveInterest.execute(
                new SaveResearchInterest.Input(id, uid, input.visible(), input.name(), input.contactUrl()),
                ResearchInterestsResponse::from);
    }

    @Override
    public ResearchResponse cancel(String uid, UUID id) {
        return cancel.execute(new CancelResearch.Input(id, uid), output -> ResearchResponse.from(output.result()));
    }
}
