window.__ModuleLoader__.load({
	id: "dsh-approval-session-allow",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const h = react.createElement;
		//#region stylesheet
		// Mirrors the shipped approval panel, plus a grants line for revocation.
		const css = ".dsa_root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}.dsa_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:var(--dsw-radius-xl);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);overflow:hidden}.dsa_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}.dsa_body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}.dsa_headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px}.dsa_command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}.dsa_actionRow{justify-content:flex-end;align-items:center;gap:8px;padding:14px 16px;display:flex;flex-wrap:wrap}.dsa_reject:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-color:#0000}.dsa_grants{color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;padding-bottom:2px;font-size:12px;line-height:18px;display:flex;flex-wrap:wrap}.dsa_grantChip{color:var(--dsw-alias-label-tertiary);background:0 0;border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:999px;align-items:center;gap:4px;padding:1px 8px;font:inherit;font-family:var(--ds-font-family-code);cursor:pointer;display:inline-flex}.dsa_grantChip:hover:not(:disabled){color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}";
		const tagId = "dsh-approval-session-allow/ApprovalPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-approval-session-allow";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const styles = {
			root: "dsa_root",
			card: "dsa_card",
			strip: "dsa_strip",
			body: "dsa_body",
			headline: "dsa_headline",
			command: "dsa_command",
			actionRow: "dsa_actionRow",
			reject: "dsa_reject",
			grants: "dsa_grants",
			grantChip: "dsa_grantChip"
		};
		//#endregion
		//#region session grants
		/**
		 * Session-scoped "allow for this conversation" grants.
		 *
		 * Shape: `{ [sessionId]: { [toolName]: true } }`, persisted in the page's
		 * localStorage so a reload of the same conversation keeps the decision.
		 * The grant is keyed by Session + Tool: approving `pwsh` for one
		 * conversation never widens another conversation or another tool, and a
		 * sub-agent (its own Session) needs its own grant.
		 */
		const STORAGE_KEY = "dsh.approval.sessionAllow.v1";
		/** @returns {Record<string, Record<string, boolean>>} */
		function readAllGrants() {
			try {
				const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
				if (raw === null) return {};
				const parsed = JSON.parse(raw);
				return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
			} catch (error) {
				return {};
			}
		}
		/** @returns {Record<string, boolean>} */
		function grantsOf(sessionId) {
			if (sessionId === void 0) return {};
			const value = readAllGrants()[sessionId];
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function writeAllGrants(all) {
			try {
				if (typeof localStorage === "undefined") return;
				localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
			} catch (error) {
				// A full or blocked storage keeps the grant alive only for this render; never break the panel.
			}
		}
		function isGrantedForSession(sessionId, toolName) {
			if (typeof toolName !== "string" || toolName === "") return false;
			return grantsOf(sessionId)[toolName] === true;
		}
		function grantForSession(sessionId, toolName) {
			if (sessionId === void 0 || typeof toolName !== "string" || toolName === "") return;
			const all = readAllGrants();
			all[sessionId] = {
				...grantsOf(sessionId),
				[toolName]: true
			};
			writeAllGrants(all);
		}
		function revokeFromSession(sessionId, toolName) {
			if (sessionId === void 0) return;
			const all = readAllGrants();
			const grants = {
				...grantsOf(sessionId)
			};
			delete grants[toolName];
			if (Object.keys(grants).length === 0) delete all[sessionId];
			else all[sessionId] = grants;
			writeAllGrants(all);
		}
		/** @returns {string[]} the tools currently auto-allowed in one session. */
		function grantedToolsOf(sessionId) {
			return Object.keys(grantsOf(sessionId)).sort();
		}
		//#endregion
		//#region panel
		/**
		 * Render one pending approval and its optional Tool-owned detail.
		 * @param props - selector-matched request and standard Slot props.
		 * @returns The approval composer takeover.
		 */
		function ApprovalPanel(props) {
			const approval = props.matched;
			const detail = approval.callId === void 0 ? null : props.renderSlot("conversation.approval.detail", { callId: approval.callId });
			return h(ApprovalFlow, {
				key: approval.key,
				pending: approval,
				reason: approval.displayReason === void 0 ? approval.reason : props.resolveReason(approval.displayReason),
				detail,
				t: props.t
			});
		}
		function ApprovalFlow({ pending, reason, detail, t }) {
			const [answered, setAnswered] = react.useState(false);
			const [grants, setGrants] = react.useState(() => grantedToolsOf(pending.sessionId));
			const waiting = react.useRef(false);
			const active = react.useRef(true);
			const composing = react.useRef(false);
			const compositionEnded = react.useRef(false);
			react.useEffect(() => {
				active.current = true;
				return () => {
					active.current = false;
				};
			}, []);
			/**
			 * Answer this request once, optionally remembering the decision for the
			 * rest of the conversation. `remember` opens the gate before the Host
			 * can ask again, which matters because a granted tool may already have
			 * another escalation queued.
			 */
			const answer = (outcome, remember) => {
				if (waiting.current || !pending.answerable) return;
				waiting.current = true;
				setAnswered(true);
				if (remember === true) {
					grantForSession(pending.sessionId, pending.toolName);
					setGrants(grantedToolsOf(pending.sessionId));
				}
				pending.answer(outcome).catch(() => {
					if (!active.current || !pending.answerable) return;
					waiting.current = false;
					setAnswered(false);
				});
			};
			const revoke = (toolName) => {
				revokeFromSession(pending.sessionId, toolName);
				setGrants(grantedToolsOf(pending.sessionId));
			};
			const keydown = (event) => {
				const element = event.target;
				if (event.defaultPrevented || !event.currentTarget.contains(document.activeElement) || element.closest("input, textarea, select, [contenteditable=\"true\"], [contenteditable=\"\"]") !== null) return;
				if (event.key !== "Enter" && event.key !== "Escape") return;
				if (event.key === "Enter" && element.closest("button, a[href], [role=\"button\"]") !== null) return;
				if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
				event.preventDefault();
				event.stopPropagation();
				if (event.repeat || composing.current || compositionEnded.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
				answer(event.key === "Enter" ? "allowed-once" : "rejected", false);
			};
			return h("div", {
				className: styles.root,
				"data-approval-key": pending.key,
				"aria-busy": answered,
				onKeyDown: keydown,
				onKeyUpCapture: () => {
					compositionEnded.current = false;
				},
				onCompositionStartCapture: () => {
					composing.current = true;
				},
				onCompositionEndCapture: () => {
					composing.current = false;
					compositionEnded.current = true;
				}
			}, h("div", { className: styles.card }, h("div", { className: styles.strip }, h(primitives.StateDot, { state: answered ? "ongoing" : "warning" }), t("waiting")), h("div", {
				className: styles.body,
				"data-approval-scroll": "",
				tabIndex: 0,
				role: "group",
				"aria-label": t("detail.aria")
			}, h("div", { className: styles.headline }, reason ?? t("escalation", { toolName: pending.toolName })), detail !== null && h("div", { className: styles.command }, detail), grants.length > 0 && h("div", { className: styles.grants }, h("span", null, t("granted")), grants.map((toolName) => h("button", {
				key: toolName,
				type: "button",
				className: styles.grantChip,
				title: t("revokeHint", { toolName }),
				disabled: answered,
				onClick: () => {
					revoke(toolName);
				}
			}, toolName + " ×")))), h("div", { className: styles.actionRow }, h(primitives.Button, {
				variant: "outline",
				className: styles.reject,
				disabled: answered,
				onClick: () => {
					answer("rejected", false);
				}
			}, t("reject")), h(primitives.Button, {
				variant: "outline",
				title: t("allowSessionHint", { toolName: pending.toolName }),
				disabled: answered,
				onClick: () => {
					answer("allowed-once", true);
				}
			}, t("allowSession")), h(primitives.Button, {
				variant: "primary",
				disabled: answered,
				onClick: () => {
					answer("allowed-once", false);
				}
			}, t("allowOnce")))));
		}
		//#endregion
		//#region pending interaction
		function settlePendingComposer(settle, failureMessage) {
			try {
				settle();
				return Promise.resolve();
			} catch (error) {
				return Promise.reject(error instanceof Error ? error : new Error(failureMessage, { cause: error }));
			}
		}
		let nextApprovalKey = 0;
		/** One answerable Client presentation of a pending Host waterfall. */
		class PendingApproval {
			sessionId;
			/** Domain discriminator used by Session pending-interaction consumers. */
			kind = "approval";
			/** Opaque render identity and one-shot remount axis. */
			key;
			/** Tool requesting the decision. */
			toolName;
			/** Correlated Tool call, when supplied by the asker. */
			callId;
			/** Human-readable reason supplied by the asker. */
			reason;
			/** Localized presentation copy, when supplied by the asker. */
			displayReason;
			/** Result returned by the Remote Event listener to the Host waterfall. */
			result;
			#resolve;
			#reject;
			#signal;
			#onAbort;
			#delegated = Symbol("pending approval delegated");
			#settled = false;
			constructor(sessionId, request) {
				this.sessionId = sessionId;
				nextApprovalKey += 1;
				this.key = `approval:${String(nextApprovalKey)}`;
				this.toolName = request.toolName;
				this.callId = request.callId;
				this.reason = request.reason;
				this.displayReason = request.displayReason;
				const completion = Promise.withResolvers();
				this.result = completion.promise;
				this.#resolve = completion.resolve;
				this.#reject = completion.reject;
				this.#signal = request.signal;
				if (request.signal === void 0) {
					this.#onAbort = void 0;
					return;
				}
				const onAbort = () => {
					this.abort(request.signal?.reason ?? new Error("approval request was aborted"));
				};
				this.#onAbort = onAbort;
				request.signal.addEventListener("abort", onAbort, { once: true });
				if (request.signal.aborted) onAbort();
			}
			/** @returns whether this request can still accept a decision. */
			get answerable() {
				return !this.#settled;
			}
			/** Resolve the Host waterfall with the user's decision. */
			answer(outcome) {
				return settlePendingComposer(() => {
					this.finish(() => {
						this.#resolve(outcome);
					});
				}, "pending approval settlement failed");
			}
			/** Delegate an unanswered request to the next waterfall listener. */
			delegate() {
				if (this.#settled) return;
				this.finish(() => {
					this.#reject(this.#delegated);
				});
			}
			isDelegation(reason) {
				return reason === this.#delegated;
			}
			abort(reason) {
				if (this.#settled) return;
				this.finish(() => {
					this.#reject(reason);
				});
			}
			finish(settle) {
				if (this.#settled) throw new Error(`pending approval ${this.key} is already settled`);
				this.#settled = true;
				if (this.#signal !== void 0 && this.#onAbort !== void 0) this.#signal.removeEventListener("abort", this.#onAbort);
				settle();
			}
		}
		//#endregion
		//#region locales
		const NS = "approval-session-allow";
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			waiting: "等待审批",
			"detail.aria": "审批详情",
			escalation: "工具 {toolName} 请求越权执行",
			reject: "拒绝",
			allowOnce: "允许一次",
			allowSession: "本对话均允许",
			allowSessionHint: "本对话内自动允许 {toolName} 的越权请求，可在审批面板中撤销",
			granted: "本对话已自动允许",
			revokeHint: "撤销本对话对 {toolName} 的自动允许"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en = {
			waiting: "Waiting for approval",
			"detail.aria": "Approval details",
			escalation: "Tool {toolName} requests privileged execution",
			reject: "Reject",
			allowOnce: "Allow once",
			allowSession: "Allow for this conversation",
			allowSessionHint: "Auto-allow {toolName} for the rest of this conversation; revocable from the approval panel",
			granted: "Auto-allowed in this conversation",
			revokeHint: "Revoke the automatic allowance for {toolName} in this conversation"
		};
		//#endregion
		//#region apply
		/** Required services: Agent scopes, Remote Events, Session UI, Slot registry, and copy. */
		const inject = [
			"sessions",
			"remote",
			"uiSession",
			"slots",
			"locale"
		];
		/**
		 * Present one request until the user answers or its lifetime ends.
		 * @param ctx - Client root context.
		 * @param owner - the scoped Agent the Host routed the request through.
		 * @param request - Host approval request projected through the Remote Event.
		 * @param next - the remaining waterfall listeners.
		 * @param registerPendingInteraction - Session pending-interaction registry.
		 * @returns the user's outcome for the waiting Host request.
		 */
		async function answerApproval(ctx, owner, request, next, registerPendingInteraction) {
			const sessionId = ctx.sessions.scopeOf(owner);
			if (sessionId === void 0) return next();
			const pending = new PendingApproval(sessionId, {
				toolName: request.toolName,
				...request.callId === void 0 ? {} : {
					callId: request.callId
				},
				...request.reason === void 0 ? {} : {
					reason: request.reason
				},
				...request.displayReason === void 0 ? {} : {
					displayReason: request.displayReason
				},
				...request.signal === void 0 ? {} : {
					signal: request.signal
				}
			});
			const completed = Promise.withResolvers();
			const remove = registerPendingInteraction(pending, async () => {
				pending.delegate();
				await completed.promise;
			});
			try {
				try {
					return await pending.result;
				} catch (error) {
					if (pending.isDelegation(error)) return await next();
					throw error;
				}
			} finally {
				remove();
				completed.resolve();
			}
		}
		/**
		 * Install approval copy and the scoped waterfall consumer.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "approval-session-allow: dictionaries");
			ctx.inject(["shortcuts"], (scope) => {
				const t = ctx.locale.bind(NS);
				scope.effect(() => scope.shortcuts.registerFixed({
					id: "approvalSessionAllow.allow",
					label: () => t("allowOnce"),
					keys: ["Enter"],
					bindings: [{
						code: "Enter",
						modifiers: []
					}],
					group: "approval"
				}), "approval-session-allow: fixed allow reference");
				scope.effect(() => scope.shortcuts.registerFixed({
					id: "approvalSessionAllow.reject",
					label: () => t("reject"),
					keys: ["Esc"],
					bindings: [{
						code: "Escape",
						modifiers: []
					}],
					group: "approval"
				}), "approval-session-allow: fixed reject reference");
			});
			const registerPendingInteraction = ctx.uiSession.registerPendingInteraction(() => 0);
			ctx.slots.inject("conversation.composer", () => ctx.slots.register({
				name: "conversation.composer",
				priority: 1,
				select: ({ pendingInteraction }) => pendingInteraction instanceof PendingApproval ? pendingInteraction : null,
				locale: NS,
				inject: () => ({
					resolveReason: (reason) => ctx.locale.resolveText(reason)
				}),
				children: {
					"conversation.approval.detail": {
						kind: "single",
						scope: "session"
					}
				}
			}, ApprovalPanel));
			ctx.remote.$on("approval/request", function(request, next) {
				const sessionId = typeof request.toolName === "string" ? ctx.sessions.scopeOf(this) : void 0;
				if (sessionId !== void 0 && isGrantedForSession(sessionId, request.toolName)) return Promise.resolve("allowed-once");
				return answerApproval(ctx, this, request, next, registerPendingInteraction);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		// Debug/test surface: the grant store is module-private otherwise, and a
		// headless check of the "allow for this conversation" contract needs it.
		exports.__internals = {
			STORAGE_KEY,
			grantForSession,
			revokeFromSession,
			isGrantedForSession,
			grantedToolsOf
		};
		return module.exports;
	}
});
