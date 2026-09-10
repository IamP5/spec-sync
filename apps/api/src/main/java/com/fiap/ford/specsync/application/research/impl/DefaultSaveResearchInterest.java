package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.SaveResearchInterest;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
import java.net.URI;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultSaveResearchInterest extends SaveResearchInterest {
    private final ResearchInterestGateway gateway;

    public DefaultSaveResearchInterest(ResearchInterestGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        Research.requireIdentity(input.id(), input.uid());
        if (input.visible()) {
            String name = input.name() == null ? "" : input.name().strip();
            String contact =
                    input.contactUrl() == null ? "" : input.contactUrl().strip();
            Research.require(
                    !name.isBlank() && name.length() <= 80 && name.codePoints().noneMatch(Character::isISOControl),
                    "Provide a display name up to 80 characters");
            URI uri = null;
            try {
                uri = URI.create(contact);
            } catch (IllegalArgumentException ignored) {
                /* Validated below. */
            }
            Research.require(
                    contact.length() <= 500
                            && uri != null
                            && "https".equalsIgnoreCase(uri.getScheme())
                            && uri.getHost() != null
                            && uri.getHost().contains(".")
                            && uri.getUserInfo() == null,
                    "Provide an HTTPS contact link");
            gateway.save(input.id(), input.uid(), name, contact);
        } else gateway.remove(input.id(), input.uid());
        var result = gateway.list(input.id(), input.uid());
        return () -> result;
    }
}
