export function handleTablistKeyDown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const currentTab = event.target.closest?.('[role="tab"]');
  if (!currentTab || !event.currentTarget.contains(currentTab)) return;

  const tabs = Array.from(
    event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')
  );
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0) return;

  let nextIndex = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  }

  if (nextIndex === null) return;
  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
}
