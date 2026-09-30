/// <reference path="../../preload/api.d.ts" />

const list = document.getElementById("list") as HTMLUListElement;

async function refresh() {
  const items = await window.launchers.list();
  list.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = `
      아직 바로가기가 없어요
      <div class="hint">푸들에게 파일을 끌어놓거나 위 버튼으로 추가하세요</div>
    `;
    list.appendChild(empty);
    return;
  }
  for (const l of items) {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.id = l.id;
    const icon = l.type === "url" ? null : await window.launchers.iconFor(l.id);
    const iconHtml = icon
      ? `<img class="icon" src="${icon}"/>`
      : `<span class="icon-fallback">${l.type === "url" ? "🌐" : l.type === "folder" ? "📁" : "📄"}</span>`;
    li.innerHTML = `
      <span class="drag-handle">⋮⋮</span>
      ${iconHtml}
      <span class="name" title=""></span>
      <div class="actions">
        <button data-a="open" title="열기">▶</button>
        <button data-a="del" title="삭제">🗑</button>
      </div>`;
    const nameEl = li.querySelector(".name") as HTMLElement;
    nameEl.textContent = l.name;
    nameEl.title = l.target;
    li.querySelector('[data-a="open"]')!.addEventListener("click", async () => {
      const r = await window.launchers.open(l.id);
      if (!r.ok) nameEl.classList.add("warn");
    });
    li.querySelector('[data-a="del"]')!.addEventListener("click", async () => {
      if (confirm("삭제할까요?")) { await window.launchers.remove(l.id); refresh(); }
    });
    // drag reorder
    li.addEventListener("dragstart", () => li.classList.add("dragging"));
    li.addEventListener("dragend", async () => {
      li.classList.remove("dragging");
      const ids = Array.from(list.children).map(x => (x as HTMLElement).dataset.id ?? "").filter(Boolean);
      await window.launchers.reorder(ids);
    });
    list.appendChild(li);
  }
}

list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = list.querySelector(".dragging");
  const after = getDragAfter(list, (e as DragEvent).clientY);
  if (!dragging) return;
  if (after == null) list.appendChild(dragging);
  else list.insertBefore(dragging, after);
});

function getDragAfter(container: HTMLUListElement, y: number): Element | null {
  const els = [...container.querySelectorAll("li:not(.dragging)")] as HTMLElement[];
  return els.reduce<{ el: Element | null; offset: number }>((acc, el) => {
    const r = el.getBoundingClientRect();
    const offset = y - r.top - r.height / 2;
    return offset < 0 && offset > acc.offset ? { el, offset } : acc;
  }, { el: null, offset: -Infinity }).el;
}

document.getElementById("add-file")!.addEventListener("click", async () => {
  const p = await window.launchers.pickFile();
  if (p) { await window.launchers.add({ target: p }); refresh(); }
});

// window.prompt은 Electron에서 안 먹으므로 인라인 모달 사용
function showModal(opts: { title: string; initial?: string; placeholder?: string }): Promise<string | null> {
  const backdrop = document.getElementById("modal-backdrop")!;
  const titleEl = document.getElementById("modal-title")!;
  const input = document.getElementById("modal-input") as HTMLInputElement;
  const ok = document.getElementById("modal-ok")!;
  const cancel = document.getElementById("modal-cancel")!;

  titleEl.textContent = opts.title;
  input.value = opts.initial ?? "";
  input.placeholder = opts.placeholder ?? "";
  backdrop.hidden = false;
  setTimeout(() => { input.focus(); input.select(); }, 0);

  return new Promise((resolve) => {
    const finish = (val: string | null) => {
      backdrop.hidden = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onOk = () => finish(input.value.trim() || null);
    const onCancel = () => finish(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); onOk(); }
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    };
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
  });
}

document.getElementById("add-url")!.addEventListener("click", async () => {
  const u = await showModal({ title: "URL 추가", initial: "https://", placeholder: "https://example.com" });
  if (u) { await window.launchers.add({ target: u, type: "url" }); refresh(); }
});

refresh();
export {};
