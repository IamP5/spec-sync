import { z } from 'zod';

/**
 * Model catalog route of the AI service, reached through the `/ai` proxy of
 * the web server. Part of the contract with `apps/ai` (`CHAT_MODELS_PATH` in
 * `src/mastra/chat-model-route.ts`).
 */
export const CHAT_MODELS_URL = '/ai/chat/models';

/**
 * Key of the AG-UI `forwardedProps` that carries the chat mode the user
 * picked. Part of the contract with `apps/ai`; the service maps the mode to
 * the model each role runs on.
 */
export const CHAT_MODE_PROPERTY = 'mode';

/**
 * Key of the AG-UI `forwardedProps` that carries the language the browser is
 * running in (a BCP 47 tag). Part of the contract with `apps/ai`: the agent
 * answers in it, so a Portuguese interface gets a Portuguese reply. An
 * unknown tag is ignored and the agent keeps its default language.
 */
export const CHAT_LOCALE_PROPERTY = 'locale';

/**
 * Key of the AG-UI `forwardedProps` that carries the reasoning effort the
 * user picked. Part of the contract with `apps/ai` (`CHAT_EFFORT_PROPERTY`);
 * the service maps it to the thinking settings of the model's vendor.
 */
export const CHAT_EFFORT_PROPERTY = 'effort';

/**
 * The three tiers the composer offers, cheapest first. The ids are the wire
 * contract with the AI service and predate the tier names the user sees
 * (Instant / Balanced / Deep, see `modeLabels`). A tier is a map from role to
 * model and reasoning effort owned by the AI service, so the browser only ever
 * names it. The service may list further modes of its own (`auto`); the
 * browser does not offer them and drops them from the catalog.
 */
export const CHAT_MODES = ['velocity', 'normal', 'intelligent'] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

/** What the service runs on when the browser sends no mode. */
export const DEFAULT_CHAT_MODE: ChatMode = 'normal';

/**
 * Below this many reference turns of balance, switching to a mode is confirmed
 * first. Affordability is the whole trigger: an earlier draft also required the
 * mode to cost more than 3x Normal, which never fires on the real rate card
 * because Intelligent is 2.7x Normal. The per-row estimate carries the cost
 * signal; this step exists for the user who is about to run out.
 */
const LOW_BALANCE_TURNS = 20;

export const chatModeOptionSchema = z.object({
  id: z.enum(CHAT_MODES),
  label: z.string().min(1),
  description: z.string().default(''),
  /** The model the `chat` role runs on; `null` when the service names none. */
  chatModelId: z.string().nullish().default(null),
  /** Micro-credits for the service's reference turn; `null` when unpriced. */
  estimatedCredits: z.number().nullish().default(null),
  /** `estimatedCredits` over Normal's, one decimal; `null` when unpriced. */
  relativeCost: z.number().nullish().default(null),
  /** `null` while credits are disabled; the browser recomputes it from its wallet. */
  affordable: z.boolean().nullish().default(null),
});

export const chatEffortOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

/**
 * What the AI service offers right now: the modes with their cost and the
 * reasoning efforts it can apply to them. A mode the browser does not offer
 * (`auto`) fails `chatModeOptionSchema` and is dropped rather than failing the
 * whole read; the same holds for a default mode it does not know.
 */
export const chatModelCatalogSchema = z.object({
  defaultModeId: z.enum(CHAT_MODES).catch(DEFAULT_CHAT_MODE),
  modes: z
    .array(chatModeOptionSchema.nullable().catch(null))
    .default([])
    .transform((modes) => modes.filter((mode) => mode !== null)),
  defaultEffortId: z.string().min(1),
  efforts: z.array(chatEffortOptionSchema).default([]),
});

export type ChatModeOption = z.infer<typeof chatModeOptionSchema>;
export type ChatEffortOption = z.infer<typeof chatEffortOptionSchema>;
export type ChatModelCatalog = z.infer<typeof chatModelCatalogSchema>;

/**
 * Labels for the ids the AI service is known to offer. The service names them
 * in the source language; the browser is where the user's language lives, so
 * the catalog is translated here on the way in and an id we do not know keeps
 * the service's own wording (see `localizeCatalog`).
 */
function modeLabels(): Record<
  ChatMode,
  { label: string; description: string }
> {
  return {
    velocity: {
      label: $localize`Instant`,
      description: $localize`Quick answers at the lowest cost.`,
    },
    normal: {
      label: $localize`Balanced`,
      description: $localize`Thorough answers for everyday questions.`,
    },
    intelligent: {
      label: $localize`Deep`,
      description: $localize`The strongest reasoning for hard comparisons.`,
    },
  };
}

function effortLabels(): Record<string, string> {
  return {
    auto: $localize`Auto`,
    low: $localize`Low`,
    medium: $localize`Medium`,
    high: $localize`High`,
  };
}

/**
 * The catalog in the user's language. Everything the service phrases is
 * replaced when the id is one we ship a translation for.
 */
export function localizeCatalog(catalog: ChatModelCatalog): ChatModelCatalog {
  const modes = modeLabels();
  const efforts = effortLabels();
  return {
    ...catalog,
    modes: catalog.modes.map((mode) => ({
      ...mode,
      label: modes[mode.id]?.label ?? mode.label,
      description: modes[mode.id]?.description ?? mode.description,
    })),
    efforts: catalog.efforts.map((effort) => ({
      ...effort,
      label: efforts[effort.id] ?? effort.label,
    })),
  };
}

/**
 * The mode to send with a run: the stored preference while the service still
 * offers it, otherwise nothing, which lets the service pick its default.
 */
export function effectiveMode(
  preference: string,
  catalog: ChatModelCatalog | undefined,
): ChatMode | '' {
  if (!isChatMode(preference)) {
    return '';
  }
  if (!catalog) {
    return preference;
  }
  return catalog.modes.some((mode) => mode.id === preference) ? preference : '';
}

/**
 * The reasoning effort to send with a run: the stored preference when the
 * service still offers it, otherwise nothing, which lets the service decide.
 */
export function effectiveEffort(
  preference: string,
  catalog: ChatModelCatalog | undefined,
): string {
  if (!catalog) {
    return preference;
  }
  return catalog.efforts.some((effort) => effort.id === preference)
    ? preference
    : '';
}

export function isChatMode(value: string): value is ChatMode {
  return (CHAT_MODES as readonly string[]).includes(value);
}

/**
 * How many reference turns the balance still covers on a mode. The service
 * prices one reference turn per mode (`estimatedCredits`), so the count is
 * the honest way to say what a switch costs without naming money.
 */
export function messagesCovered(
  available: number,
  estimatedCredits: number | null | undefined,
): number {
  if (!estimatedCredits || estimatedCredits <= 0 || available <= 0) {
    return 0;
  }
  return Math.floor(available / estimatedCredits);
}

/**
 * Whether switching to `mode` has to be confirmed first: it costs more than
 * three times Normal and the wallet covers fewer than twenty of its replies.
 * Nobody should discover the price of Intelligent by running out.
 *
 * Unknown available credits (the wallet is off or unread) never confirm.
 */
export function needsCostConfirmation(
  mode: ChatModeOption | undefined,
  available: number | undefined,
): boolean {
  if (!mode || available === undefined || !mode.estimatedCredits) {
    return false;
  }
  return messagesCovered(available, mode.estimatedCredits) < LOW_BALANCE_TURNS;
}
