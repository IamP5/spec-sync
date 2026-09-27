package com.fiap.ford.specsync.infrastructure.configuration;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import tools.jackson.databind.json.JsonMapper;

/**
 * RFC 9457 bodies for the failures Spring Security answers before a controller runs (401 and 403),
 * so every error of the API, from the filter chain or from {@link GlobalExceptionHandler}, has the
 * same {@code application/problem+json} shape.
 */
public final class ProblemResponses {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private ProblemResponses() {}

    /**
     * 401 with {@code WWW-Authenticate: Bearer ...} (RFC 6750, set by Spring's bearer entry point,
     * including {@code error="invalid_token"} for expired or tampered tokens) and a problem body.
     */
    public static AuthenticationEntryPoint unauthorized(final String detail) {
        final var bearer = new BearerTokenAuthenticationEntryPoint();
        return (request, response, failure) -> {
            bearer.commence(request, response, failure);
            write(request, response, HttpStatus.UNAUTHORIZED, detail, reason(failure));
        };
    }

    /** 403: the token is valid but its roles do not allow this operation. */
    public static AccessDeniedHandler forbidden(final String detail) {
        return (request, response, denied) -> write(request, response, HttpStatus.FORBIDDEN, detail, null);
    }

    private static String reason(final AuthenticationException failure) {
        // Name why a presented token was refused (expired, bad signature, wrong audience...);
        // a request without any token gets no reason.
        return failure instanceof InvalidBearerTokenException ? failure.getMessage() : null;
    }

    static void write(
            final HttpServletRequest request,
            final HttpServletResponse response,
            final HttpStatus status,
            final String detail,
            final String reason)
            throws IOException {
        final var body = new LinkedHashMap<String, Object>();
        body.put("type", "about:blank");
        body.put("title", status.getReasonPhrase());
        body.put("status", status.value());
        body.put("detail", detail);
        body.put("instance", request.getRequestURI());
        if (reason != null) {
            body.put("reason", reason);
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(JSON.writeValueAsString(body));
    }
}
