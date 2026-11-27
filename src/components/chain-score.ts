export function chainScorePresentation(progress: number) {
  const score = Number.isFinite(progress) ? Math.max(0, Math.floor(progress)) : 0;
  return { text: String(score).padStart(2, "0"), chaining: score > 1 };
}

// One persistent header, outside the replaceable list. No library-specific UI rules.
export function mountChainScore(host: HTMLElement, onReset: () => void) {
  const root = document.createElement("section");
  root.className = "chain-meter";
  root.setAttribute("aria-label", "Chain score and reset");
  const label = document.createElement("span");
  label.className = "chain-label";
  label.append("Chain ");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "chain-reset";
  reset.textContent = "×";
  reset.addEventListener("click", onReset);
  label.append(reset);
  const score = document.createElement("strong");
  score.setAttribute("aria-live", "polite");
  score.setAttribute("aria-atomic", "true");
  root.append(label, score);
  host.replaceChildren(root);
  return {
    render(progress: number, libraryLabel: string) {
      const view = chainScorePresentation(progress);
      score.textContent = view.text;
      score.setAttribute("aria-label", `${libraryLabel} chain score ${view.text}`);
      root.classList.toggle("is-chaining", view.chaining);
      reset.setAttribute("aria-label", `Reset ${libraryLabel} chain progress`);
      reset.title = `Reset ${libraryLabel} chain`;
    },
    destroy() { reset.removeEventListener("click", onReset); root.remove(); }
  };
}
