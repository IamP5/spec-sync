# PROTOTYPE — home screen variants (throwaway)

Five variants of the empty-conversation home screen, switchable via
`?variant=a|b|c|d|e` on the root route (`/`). No param renders the selected
E design with monochrome, side-by-side branding. `?variant=current` retains
the original design. The floating switcher only renders for explicit variants
in dev mode on desktop, leaving the mobile composer unobstructed.

Question answered: "What should a more modern, Vercel-like home screen with a
Ford-related motion background look like?"

Option E combines A's dot grid with slower neutral/blue beams and a cursor
spotlight, D's suggestion rows, and the Ford script + SpecSync wordmark.
Use the dev switcher to compare `brand=mixed|mono|blue` and
`lockup=inline|stacked`; these query parameters make each treatment bookmarkable.
The background and row lighting respect reduced motion. Catalog/comparison
actions use the same prompts and authentication flow as the current home.
On mobile, two compact, borderless suggestion rows sit directly above the bottom
composer. The logo and tagline occupy the remaining space and can scroll when
needed. The shell's existing visual viewport sizing keeps the actions and input
above the keyboard.

Delete this folder (and the `@switch (variant())` block in `chat-page.html`)
once a winner is folded into the real page.
