/**
 * Host half of the approval-session-allow plugin.
 *
 * The whole feature lives in the browser bundle (`lib/client.js`): it replaces
 * the shipped approval composer panel with one that also offers "allow for this
 * conversation", and remembers that grant per Session + Tool in the page.
 * The Host only needs this Loader entry to exist so `dsh-client-modules`
 * publishes the browser bundle, so `apply` stays empty on purpose.
 */
export function apply() {}
