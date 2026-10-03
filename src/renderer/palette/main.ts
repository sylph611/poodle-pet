type PaletteItem = {
  kind: "memo" | "snippet" | "clipboard" | "launcher";
  id: string;
  text: string;
  meta?: string;
};

const ICON: Record<PaletteItem["kind"], string> = {
  memo: "📝",
  snippet: "📎",
  clipboard: "📋",
  launcher: "🚀"
};
const LABEL: Record<PaletteItem["kind"], string> = {
  memo: "메모",
  snippet: "스니펫",
  clipboard: "클립보드",
  launcher: "바로가기"
};

const q = document.getElementById("q") as HTMLInputElement;
const results = document.getElementById("results") as HTMLUListElement;

let items: PaletteItem[] = [];
let activeIdx = 0;

const pal = window.palette;

function render() {
  results.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = q.value ? "결과 없음" : "복사한 내용·메모·바로가기가 여기에…";
    results.appendChild(empty);
    return;
  }
  items.forEach((it, i) => {
    const li = document.createElement("li");
    if (i === activeIdx) li.classList.add("active");
    li.innerHTML = `
      <span class="item-icon">${ICON[it.kind]}</span>
      <span class="item-text"></span>
      <span class="item-meta"></span>
    `;
    (li.querySelector(".item-text") as HTMLSpanElement).textContent = it.text;
    (li.querySelector(".item-meta") as HTMLSpanElement).textContent = it.meta ?? LABEL[it.kind];
    li.addEventListener("click", () => activate(i, false));
    results.appendChild(li);
  });
}

async function search() {
  items = await pal.search(q.value);
  activeIdx = 0;
  render();
}

async function activate(idx: number, editMode: boolean) {
  const it = items[idx];
  if (!it) return;
  await pal.select({ kind: it.kind, id: it.id, editMode });
  pal.close();
}

async function createMemoFromInput() {
  const text = q.value.trim();
  if (!text) {
    await pal.openMemoWindow();
  } else {
    await pal.createMemo(text);
  }
  pal.close();
}

q.addEventListener("input", search);
q.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    pal.close();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx = Math.min(items.length - 1, activeIdx + 1);
    render();
    scrollActiveIntoView();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx = Math.max(0, activeIdx - 1);
    render();
    scrollActiveIntoView();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (e.ctrlKey) {
      createMemoFromInput();
    } else if (e.shiftKey) {
      if (items.length === 0) {
        createMemoFromInput();
      } else {
        activate(activeIdx, true);
      }
    } else {
      activate(activeIdx, false);
    }
  }
});

function scrollActiveIntoView() {
  const el = results.children[activeIdx] as HTMLElement | undefined;
  el?.scrollIntoView({ block: "nearest" });
}

pal.onReset(() => {
  q.value = "";
  q.focus();
  search();
});

search();

export {};
