type PaletteItem = {
  kind: "memo" | "snippet" | "clipboard" | "launcher";
  id: string;
  text: string;
  meta?: string;
};

type MenuOption = {
  label: string;
  danger?: boolean;
  action: () => Promise<void>;
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

// ─── Context menu ───
let activeMenu: HTMLElement | null = null;

function closeMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

function openMenu(idx: number, x: number, y: number) {
  closeMenu();
  const it = items[idx];
  if (!it) return;

  const options: MenuOption[] = buildOptions(it, idx);

  const menu = document.createElement("div");
  menu.className = "context-menu";

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "context-menu-item" + (opt.danger ? " danger" : "");
    btn.textContent = opt.label;
    btn.addEventListener("mousedown", async (e) => {
      e.stopPropagation();
      closeMenu();
      await opt.action();
      await search();
    });
    menu.appendChild(btn);
  }

  // Position: keep within viewport
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + rect.width > vw) left = vw - rect.width - 4;
  if (top + rect.height > vh) top = vh - rect.height - 4;
  menu.style.left = `${Math.max(0, left)}px`;
  menu.style.top = `${Math.max(0, top)}px`;

  activeMenu = menu;
}

function buildOptions(it: PaletteItem, idx: number): MenuOption[] {
  if (it.kind === "memo") {
    return [
      {
        label: "📎 스니펫으로 꽂기",
        action: async () => { await pal.togglePin(it.id); }
      },
      {
        label: "✏️ 편집",
        action: async () => { await activate(idx, true); }
      },
      {
        label: "🗑 삭제",
        danger: true,
        action: async () => { await pal.deleteItem("memo", it.id); }
      }
    ];
  }
  if (it.kind === "snippet") {
    return [
      {
        label: "📝 일반 메모로 (핀 해제)",
        action: async () => { await pal.togglePin(it.id); }
      },
      {
        label: "✏️ 편집",
        action: async () => { await activate(idx, true); }
      },
      {
        label: "🗑 삭제",
        danger: true,
        action: async () => { await pal.deleteItem("snippet", it.id); }
      }
    ];
  }
  if (it.kind === "clipboard") {
    return [
      {
        label: "📝 메모로 저장",
        action: async () => { await pal.saveClipAsMemo(it.id, false); }
      },
      {
        label: "📎 스니펫으로 저장",
        action: async () => { await pal.saveClipAsMemo(it.id, true); }
      },
      {
        label: "🗑 히스토리에서 삭제",
        danger: true,
        action: async () => { await pal.deleteItem("clipboard", it.id); }
      }
    ];
  }
  // launcher
  return [
    {
      label: "🗑 삭제",
      danger: true,
      action: async () => { await pal.deleteItem("launcher", it.id); }
    }
  ];
}

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
      <button class="more-btn" title="더보기">⋯</button>
    `;
    (li.querySelector(".item-text") as HTMLSpanElement).textContent = it.text;
    (li.querySelector(".item-meta") as HTMLSpanElement).textContent = it.meta ?? LABEL[it.kind];

    const moreBtn = li.querySelector(".more-btn") as HTMLButtonElement;
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = moreBtn.getBoundingClientRect();
      openMenu(i, r.left, r.bottom + 2);
    });

    li.addEventListener("click", () => activate(i, false));
    li.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openMenu(i, e.clientX, e.clientY);
    });

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
    if (activeMenu) {
      closeMenu();
    } else {
      pal.close();
    }
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
    } else {
      activate(activeIdx, false);
    }
  }
});

// Close menu on outside click
document.addEventListener("mousedown", (e) => {
  if (activeMenu && !activeMenu.contains(e.target as Node)) {
    closeMenu();
  }
});

function scrollActiveIntoView() {
  const el = results.children[activeIdx] as HTMLElement | undefined;
  el?.scrollIntoView({ block: "nearest" });
}

pal.onReset(() => {
  closeMenu();
  q.value = "";
  q.focus();
  search();
});

search();

export {};
