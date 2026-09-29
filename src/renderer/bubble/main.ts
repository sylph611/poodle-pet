document.querySelectorAll<HTMLButtonElement>("button[data-a]").forEach(btn => {
  btn.addEventListener("click", () => {
    window.pet.chooseAction(btn.dataset.a as "memo" | "launcher" | "sleep");
  });
});
