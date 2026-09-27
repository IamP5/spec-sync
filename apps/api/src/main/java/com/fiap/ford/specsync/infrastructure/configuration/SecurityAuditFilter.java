package com.fiap.ford.specsync.infrastructure.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Base64;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.event.Level;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Emits one structured security event per rejected API request (401, 403, 429) and per successful
 * critical change (curation, publication, ontology activation). It runs outside Spring Security so
 * it also sees the rejections of every filter chain. Events never contain tokens, keys, bodies or
 * query strings; the caller is the gateway-verified uid or, without it, the peer address.
 */
final class SecurityAuditFilter extends OncePerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger("security.audit");
    private static final Pattern CRITICAL_CHANGE = Pattern.compile("^/api/(ingestions(/[^/]+/(publish|reject))?"
            + "|ontology/proposals/[^/]+/activate"
            + "|internal/research/users/[^/]+/requests/[^/]+/review/publish)$");
    private static final Pattern UID = Pattern.compile("^[A-Za-z0-9_-]{1,128}$");

    @Override
    protected boolean shouldNotFilter(final HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            final HttpServletRequest request, final HttpServletResponse response, final FilterChain chain)
            throws ServletException, IOException {
        final var started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            final var status = response.getStatus();
            final var event = event(request, status);
            if (event != null) {
                LOG.atLevel(status >= 400 ? Level.WARN : Level.INFO)
                        .setMessage(event)
                        .addKeyValue("event", event)
                        .addKeyValue("method", request.getMethod())
                        .addKeyValue("path", request.getRequestURI())
                        .addKeyValue("status", status)
                        .addKeyValue("caller", caller(request))
                        .addKeyValue("durationMs", (System.nanoTime() - started) / 1_000_000)
                        .log();
            }
        }
    }

    private static String event(final HttpServletRequest request, final int status) {
        return switch (status) {
            case 401 -> "security.authentication_failed";
            case 403 -> "security.access_denied";
            case 429 -> "security.rate_limited";
            default ->
                status < 300
                                && "POST".equals(request.getMethod())
                                && CRITICAL_CHANGE
                                        .matcher(request.getRequestURI())
                                        .matches()
                        ? "audit.critical_change"
                        : null;
        };
    }

    /** Rate-limit and audit key; the uid header is only trusted as a label, never as a credential. */
    static String caller(final HttpServletRequest request) {
        final var user = request.getHeader("X-SpecSync-User");
        if (user != null && user.length() <= 4096) {
            try {
                final var uid = JsonMapper.shared()
                        .readTree(Base64.getUrlDecoder().decode(user))
                        .path("uid")
                        .asString("");
                if (UID.matcher(uid).matches()) {
                    return "user:" + uid;
                }
            } catch (RuntimeException malformed) {
                // Fall back to the peer address below.
            }
        }
        return "ip:" + request.getRemoteAddr();
    }
}
