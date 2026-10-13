"use client";

/** A small copy of the product photo that flies from the card into the basket. */
export function fly(from: Element, to: Element, image: string | null, className = "sh-fly") {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const size = 56;
  const dot = document.createElement("div");
  dot.className = className;
  if (image) dot.style.backgroundImage = `url(${image})`;
  dot.style.left = `${a.left + a.width / 2 - size / 2}px`;
  dot.style.top = `${a.top + a.height / 2 - size / 2}px`;
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  // Up and over, landing small in the basket.
  const anim = dot.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${Math.min(dy * 0.5, 0) - 80}px) scale(0.8)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.6 },
    ],
    { duration: 650, easing: "cubic-bezier(.45,.05,.4,1)" },
  );
  return anim.finished.catch(() => undefined).finally(() => dot.remove());
}
