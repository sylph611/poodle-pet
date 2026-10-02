const pomoBtn = document.querySelector<HTMLButtonElement>('button[data-a="pomo"]')!;

function fmtMMSS(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

window.pet.onBubblePomoState(({ phase, remainingMs }) => {
  pomoBtn.classList.remove("focus", "break");
  if (phase === "idle") {
    pomoBtn.title = "포모도로 시작";
  } else {
    pomoBtn.classList.add(phase);
    const kind = phase === "focus" ? "집중" : "휴식";
    pomoBtn.title = `포모도로 중지 (${kind} ${fmtMMSS(remainingMs)})`;
  }
});

document.querySelectorAll<HTMLButtonElement>("button[data-a]").forEach(btn => {
  btn.addEventListener("click", () => {
    window.pet.chooseAction(btn.dataset.a as "memo" | "launcher" | "pomo" | "sleep");
  });
});

export {};
