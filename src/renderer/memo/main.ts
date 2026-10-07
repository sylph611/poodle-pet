const input = document.getElementById("input") as HTMLTextAreaElement;
const search = document.getElementById("search") as HTMLInputElement;
const list = document.getElementById("list") as HTMLUListElement;

// Electron에서 window.prompt이 안 되므로 인라인 모달
function showEditModal(initial: string): Promise<string | null> {
  const backdrop = document.getElementById("modal-backdrop")!;
  const ta = document.getElementById("modal-input") as HTMLTextAreaElement;
  const ok = document.getElementById("modal-ok")!;
  const cancel = document.getElementById("modal-cancel")!;

  ta.value = initial;
  backdrop.hidden = false;
  setTimeout(() => { ta.focus(); ta.select(); }, 0);

  return new Promise((resolve) => {
    const finish = (val: string | null) => {
      backdrop.hidden = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      ta.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onOk = () => finish(ta.value);
    const onCancel = () => finish(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onOk(); }
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    };
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    ta.addEventListener("keydown", onKey);
  });
}

async function refresh() {
  const q = search.value.trim();
  const items = q ? await window.memos.search(q) : await window.memos.list();
  list.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = q ? "검색 결과가 없어요" : "아직 메모가 없어요";
    list.appendChild(empty);
    return;
  }
  for (const m of items) {
    const li = document.createElement("li");
    li.dataset.id = m.id;
    if (m.pinned) li.classList.add("pinned");
    li.innerHTML = `
      <span class="text"></span>
      <div class="actions">
        <button data-a="pin" title="고정">${m.pinned ? "📌" : "📍"}</button>
        <button data-a="copy" title="복사">📋</button>
        <button data-a="edit" title="수정">✏️</button>
        <button data-a="del" title="삭제">🗑</button>
      </div>`;
    if (m.pinned) li.querySelector('[data-a="pin"]')!.classList.add("pin-on");
    (li.querySelector(".text") as HTMLElement).textContent = m.text;
    li.querySelector('[data-a="pin"]')!.addEventListener("click", async () => {
      await window.memos.update(m.id, { pinned: !m.pinned }); refresh();
    });
    li.querySelector('[data-a="copy"]')!.addEventListener("click", () => {
      navigator.clipboard.writeText(m.text);
    });
    li.querySelector('[data-a="edit"]')!.addEventListener("click", async () => {
      const t = await showEditModal(m.text);
      if (t !== null && t.trim() !== m.text) { await window.memos.update(m.id, { text: t.trim() }); refresh(); }
    });
    li.querySelector('[data-a="del"]')!.addEventListener("click", async () => {
      if (confirm("삭제할까요?")) { await window.memos.remove(m.id); refresh(); }
    });
    list.appendChild(li);
  }
}

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    await window.memos.add(text);
    input.value = "";
    refresh();
  }
});
search.addEventListener("input", refresh);
refresh();

window.memos.onFocus((id: string) => {
  const el = list.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlight-flash");
  setTimeout(() => el.classList.remove("highlight-flash"), 1500);
});

export {};
