/**
 * The process environment, as data.
 *
 * It lives in core, not in backends, because core needs it too: osc.ts reads
 * TMUX to decide whether the escape sequences need DCS passthrough. Keeping the
 * type in backends/ would mean the heart of the product depends on the plugin
 * layer — an inversion that is invisible today and a cycle tomorrow.
 */
export type Env = Record<string, string | undefined>;
