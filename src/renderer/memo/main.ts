const input = document.getElementById("input") as HTMLTextAreaElement;
const search = document.getElementById("search") as HTMLInputElement;
const list = document.getElementById("list") as HTMLUListElement;

async function refresh() {
  const q = search.value.trim();
  const items = q ? await window.memos.search(q) : await window.memos.list();
  list.innerHTML = "";
  for (const m of items) {
    const li = document.createElement("li");
    if (m.pinned) li.classList.add("pinned");
    li.innerHTML = `
      <span class="text"></span>
      <button data-a="pin">${m.pinned ? "📌" : "📍"}</button>
      <button data-a="copy">📋</button>
      <button data-a="edit">✏️</button>
      <button data-a="del">🗑</button>`;
    (li.querySelector(".text") as HTMLElement).textContent = m.text;
    li.querySelector('[data-a="pin"]')!.addEventListener("click", async () => {
      await window.memos.update(m.id, { pinned: !m.pinned }); refresh();
    });
    li.querySelector('[data-a="copy"]')!.addEventListener("click", () => {
      navigator.clipboard.writeText(m.text);
    });
    li.querySelector('[data-a="edit"]')!.addEventListener("click", async () => {
      const t = prompt("수정", m.text);
      if (t !== null) { await window.memos.update(m.id, { text: t }); refresh(); }
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
export {};
