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
 * Key of the AG-UI `forwardedProps` that carries the advanced per-role model
 * overrides. Part of the contract with `apps/ai`: a role with no override
 * follows the mode, and an override the service cannot honour is ignored.
 */
export const CHAT_ROLE_MODELS_PROPERTY = 'roleModels';

/**
 * Key of the AG-UI `forwardedProps` that carries the reasoning effort the
 * user picked. Part of the contract with `apps/ai` (`CHAT_EFFORT_PROPERTY`);
 * the service maps it to the thinking settings of the model's vendor.
 */
export const CHAT_EFFORT_PROPERTY = 'effort';

/**
 * The four modes the composer offers, cheapest first. A mode is a map from
 * role to model owned by the AI service, so the browser only ever names it.
 */
export const CHAT_MODES = [
  'velocity',
  'normal',
  'intelligent',
  'auto',
] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

/** What the service runs on when the browser sends no mode. */
export const DEFAULT_CHAT_MODE: ChatMode = 'normal';

/**
 * Every role of the AI service's registry. Only the mode-driven, billable
 * ones appear in the catalog's `roles`; the rest are never user-configurable
 * and are listed here so the stored overrides keep the same names as
 * `apps/ai` (`ModelRole` in `src/mastra/models.ts`).
 */
export const MODEL_ROLES = [
  'chat',
  'discovery',
  'vision',
  'identification',
  'contentDiscovery',
  'extraction',
  'title',
  'router',
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

/** Advanced per-role overrides; a role without one follows the mode. */
export type RoleModels = Partial<Record<ModelRole, string>>;

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
  /** The model the `chat` role runs on; `null` for auto, which decides per prompt. */
  chatModelId: z.string().nullish().default(null),
  /** Micro-credits for the service's reference turn; `null` when unpriced. */
  estimatedCredits: z.number().nullish().default(null),
  /** `estimatedCredits` over Normal's, one decimal; `null` for auto. */
  relativeCost: z.number().nullish().default(null),
  /** `null` while credits are disabled; the browser recomputes it from its wallet. */
  affordable: z.boolean().nullish().default(null),
});

export const chatRoleOptionSchema = z.object({
  id: z.enum(MODEL_ROLES),
  label: z.string().min(1),
  /** Ids of the models this role may be overridden with, already capability-filtered. */
  models: z.array(z.string()).default([]),
});

export const chatModelOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  vendor: z.string().min(1),
  provider: z.enum(['openrouter', 'vertex']),
});

export const chatEffortOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

/**
 * What the AI service offers right now: the modes with their cost, the roles
 * the advanced selector may override and the models it may offer for them,
 * and the reasoning efforts it can apply to any of them.
 */
export const chatModelCatalogSchema = z.object({
  defaultModeId: z.enum(CHAT_MODES),
  /** The mode auto resolved to for the last run, once one has run. */
  resolvedMode: z.enum(CHAT_MODES).nullish().default(null),
  modes: z.array(chatModeOptionSchema).default([]),
  roles: z.array(chatRoleOptionSchema).default([]),
  models: z.array(chatModelOptionSchema).default([]),
  defaultEffortId: z.string().min(1),
  efforts: z.array(chatEffortOptionSchema).default([]),
});

export type ChatModeOption = z.infer<typeof chatModeOptionSchema>;
export type ChatRoleOption = z.infer<typeof chatRoleOptionSchema>;
export type ChatModelOption = z.infer<typeof chatModelOptionSchema>;
export type ChatEffortOption = z.infer<typeof chatEffortOptionSchema>;
export type ChatModelCatalog = z.infer<typeof chatModelCatalogSchema>;

const VENDOR_LABELS: Record<string, string> = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'x-ai': 'xAI',
};

/** The vendor half of an OpenRouter id (`google/gemini-3.8-flash`), for grouping. */
export function vendorLabelOf(vendor: string): string {
  return (
    VENDOR_LABELS[vendor] ?? vendor.charAt(0).toUpperCase() + vendor.slice(1)
  );
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
 * The advanced overrides to send with a run: every role the service still
 * offers, with a model it still offers for that role. Anything else is
 * dropped rather than sent, so the role simply follows the mode.
 */
export function effectiveRoleModels(
  preference: RoleModels,
  catalog: ChatModelCatalog | undefined,
): RoleModels {
  const entries = Object.entries(preference).filter(
    (entry): entry is [ModelRole, string] =>
      isModelRole(entry[0]) && typeof entry[1] === 'string' && entry[1] !== '',
  );
  if (!catalog) {
    return Object.fromEntries(entries);
  }
  return Object.fromEntries(
    entries.filter(([role, modelId]) =>
      catalog.roles.some(
        (option) => option.id === role && option.models.includes(modelId),
      ),
    ),
  );
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

export function isModelRole(value: string): value is ModelRole {
  return (MODEL_ROLES as readonly string[]).includes(value);
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
/**
 * The mode a finished run actually ran in, derived from the model it was
 * charged against.
 *
 * `auto` settles on a mode per run, and the catalog route that lists the modes
 * is unauthenticated and shared, so it cannot carry a value that belongs to one
 * user's last run. The wallet can: it is user-scoped, already refreshed after
 * every run, and records the model each run was charged at. Matching that model
 * back to the mode that names it needs no new endpoint and no new AG-UI event.
 *
 * `undefined` when the run's model belongs to no mode, or when there is no run
 * yet — the pill then shows the plain mode name.
 */
export function modeOfRunModel(
  catalog: ChatModelCatalog | undefined,
  runModelId: string | undefined,
): ChatMode | null {
  if (!catalog || !runModelId) {
    return null;
  }
  return (
    catalog.modes.find((mode) => mode.chatModelId === runModelId)?.id ?? null
  );
}

export function needsCostConfirmation(
  mode: ChatModeOption | undefined,
  available: number | undefined,
): boolean {
  if (!mode || available === undefined || !mode.estimatedCredits) {
    return false;
  }
  return messagesCovered(available, mode.estimatedCredits) < LOW_BALANCE_TURNS;
}
