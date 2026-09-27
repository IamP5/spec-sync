package com.fiap.ford.specsync.infrastructure.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fixed one-minute window per caller, in memory and per Cloud Run instance. It is a backstop that
 * bounds brute force against the curator key and scraping of the catalog; the global limit belongs
 * at the edge (gateway / Cloud Armor). Machine callers under {@code /api/internal/} are exempt: they
 * already pass IAM and a service key, and one key is shared by every user of the AI service.
 */
final class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_TRACKED_CALLERS = 10_000;

    private final int limit;
    private final LongSupplier clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    RateLimitFilter(final int limit, final LongSupplier clock) {
        this.limit = limit;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(final HttpServletRequest request) {
        final var path = request.getRequestURI();
        return !path.startsWith("/api/") || path.startsWith("/api/internal/");
    }

    @Override
    protected void doFilterInternal(
            final HttpServletRequest request, final HttpServletResponse response, final FilterChain chain)
            throws ServletException, IOException {
        final var now = clock.getAsLong();
        evictIfFull(now);
        final var window = windows.compute(
                SecurityAuditFilter.caller(request),
                (caller, current) -> current == null || now - current.start() >= WINDOW_MILLIS
                        ? new Window(now, 1)
                        : new Window(current.start(), current.count() + 1));
        if (window.count() > limit) {
            final var retryAfter = Math.max(1, (window.start() + WINDOW_MILLIS - now + 999) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(retryAfter));
            response.setContentType("application/problem+json");
            response.getWriter()
                    .write("{\"title\":\"Too Many Requests\",\"status\":429,"
                            + "\"detail\":\"Request budget exceeded; retry after the indicated delay.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    /** Keeps memory bounded when many distinct callers appear (e.g. a spoofing or scanning burst). */
    private void evictIfFull(final long now) {
        if (windows.size() < MAX_TRACKED_CALLERS) {
            return;
        }
        windows.values().removeIf(window -> now - window.start() >= WINDOW_MILLIS);
        if (windows.size() >= MAX_TRACKED_CALLERS) {
            windows.clear();
        }
    }

    private record Window(long start, int count) {}
}
