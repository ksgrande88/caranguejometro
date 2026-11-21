const START = new Date("2026-01-01T00:00:00-03:00").getTime();
const TARGET = new Date("2026-11-19T19:00:00-03:00").getTime();
const DAY = 86_400_000;

const dial = document.querySelector("#dial");
const daysElement = document.querySelector("#days");
const timePrefix = document.querySelector("#time-prefix");
const dayLabel = document.querySelector("#day-label");
const titleButton = document.querySelector("#site-title");
const timeGrid = document.querySelector("#elapsed-time");
let graduated;

function pad(number, size = 2) {
  return String(number).padStart(size, "0");
}

function updateCountdown() {
  const now = Date.now();
  const isGraduated = now >= TARGET;
  const remaining = Math.abs(TARGET - now);
  if (graduated !== isGraduated) {
    graduated = isGraduated;
    timePrefix.textContent = graduated ? "QEMA há" : "Faltam";
    timeGrid.setAttribute("aria-label", graduated ? "Tempo como QEMA" : "Tempo restante");
    dial.setAttribute("aria-label", graduated ? "CCEM concluído" : "Progresso até a conclusão do CCEM");
  }
  const elapsed = Math.min(Math.max(now - START, 0), TARGET - START);
  const progress = elapsed / (TARGET - START);
  const angle = `${(progress * 360).toFixed(3)}deg`;

  dial.style.setProperty("--progress-angle", angle);
  const days = graduated ? Math.floor(remaining / DAY) : Math.ceil(remaining / DAY);
  daysElement.textContent = String(days);
  dayLabel.textContent = days === 1 ? "dia" : "dias";
  if (!graduated) timePrefix.textContent = days === 1 ? "Falta" : "Faltam";
}

updateCountdown();
window.setInterval(updateCountdown, 1_000);

let titleHold;

function toggleTitle() {
  const agonizing = titleButton.textContent === "AGONIZÔMETRO";
  titleButton.textContent = agonizing ? "CARANGUEJÔMETRO" : "AGONIZÔMETRO";
  titleButton.classList.toggle("agonizing", !agonizing);
  window.setTimeout(() => titleButton.classList.remove("agonizing"), 420);
}

function beginTitleHold(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  window.clearTimeout(titleHold);
  titleHold = window.setTimeout(toggleTitle, 700);
}

function cancelTitleHold() {
  window.clearTimeout(titleHold);
}

titleButton.addEventListener("pointerdown", beginTitleHold);
titleButton.addEventListener("pointerup", cancelTitleHold);
titleButton.addEventListener("pointercancel", cancelTitleHold);
titleButton.addEventListener("pointerleave", cancelTitleHold);
titleButton.addEventListener("contextmenu", (event) => event.preventDefault());
titleButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleTitle();
  }
});

const slideGroups = Array.from({ length: 47 }, (_, index) => [
  `assets/memes/meme-${pad(index + 1)}.webp`
]);
for (let index = 1; index <= 22; index += 3) {
  slideGroups.push(Array.from({ length: Math.min(3, 23 - index) }, (_, offset) =>
    `assets/memes/new-${pad(index + offset)}.webp`));
}
slideGroups.push(["assets/memes/barbaros-onibus-tempestade.jpg"]);
let MEME_COUNT = slideGroups.length;
const INTERVAL = 5_000;
const stage = document.querySelector("#carousel-stage");
const carousel = document.querySelector("#carousel");
const ambient = document.querySelector("#ambient");
const countElement = document.querySelector("#slide-count");
const timerFill = document.querySelector("#carousel-timer-fill");
const previousButton = document.querySelector("#prev");
const nextButton = document.querySelector("#next");
const slides = [];
let current = 0;
let autoTimer;
let progressAnimation;
let dragStartX = null;

for (let index = 0; index < MEME_COUNT; index += 1) {
  const figure = document.createElement("figure");
  figure.className = slideGroups[index].length > 1 ? "slide grouped" : "slide";
  figure.dataset.index = String(index);
  slideGroups[index].forEach((source, position) => {
    const image = document.createElement("img");
    image.dataset.src = source;
    image.alt = `Mundo Bárbaro — quadro ${index + 1}, imagem ${position + 1}`;
    image.decoding = "async";
    image.loading = index < 3 ? "eager" : "lazy";
    image.draggable = false;
    figure.append(image);
  });
  stage.append(figure);
  slides.push(figure);
}

function wrapped(index) {
  return (index + MEME_COUNT) % MEME_COUNT;
}

function restartProgress() {
  progressAnimation?.cancel();
  progressAnimation = timerFill.animate(
    [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
    { duration: INTERVAL, easing: "linear", fill: "forwards" }
  );
}

function renderCarousel() {
  const previous = wrapped(current - 1);
  const next = wrapped(current + 1);

  slides.forEach((slide, index) => {
    slide.classList.toggle("active", index === current);
    slide.classList.toggle("prev", index === previous);
    slide.classList.toggle("next", index === next);
    const visible = index === current || index === previous || index === next;
    slide.hidden = !visible;
    if (visible) {
      slide.querySelectorAll("img[data-src]").forEach((image) => {
        if (!image.hasAttribute("src")) image.src = image.dataset.src;
      });
    }
    slide.setAttribute("aria-hidden", index === current ? "false" : "true");
  });

  countElement.textContent = `${pad(current + 1)} / ${MEME_COUNT}`;
  ambient.style.backgroundImage = `url("${slideGroups[current][0]}")`;
}

function startAuto() {
  window.clearInterval(autoTimer);
  restartProgress();
  autoTimer = window.setInterval(() => {
    current = wrapped(current + 1);
    renderCarousel();
    restartProgress();
  }, INTERVAL);
}

function move(direction) {
  current = wrapped(current + direction);
  renderCarousel();
  startAuto();
}

previousButton.addEventListener("click", () => move(-1));
nextButton.addEventListener("click", () => move(1));

stage.addEventListener("click", (event) => {
  const slide = event.target.closest(".slide");
  if (slide?.classList.contains("prev")) move(-1);
  if (slide?.classList.contains("next")) move(1);
});

carousel.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    move(1);
  }
});

stage.addEventListener("pointerdown", (event) => {
  dragStartX = event.clientX;
});

stage.addEventListener("pointerup", (event) => {
  if (dragStartX === null) return;
  const delta = event.clientX - dragStartX;
  dragStartX = null;
  if (Math.abs(delta) < 42) return;
  move(delta < 0 ? 1 : -1);
});

stage.addEventListener("pointercancel", () => {
  dragStartX = null;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.clearInterval(autoTimer);
    progressAnimation?.cancel();
  } else {
    startAuto();
  }
});

renderCarousel();
startAuto();

// Shared uploads use the same rendering and navigation as the original gallery.
window.addGalleryImage = function (source, caption) {
  const figure = document.createElement("figure");
  figure.className = "slide";
  const image = document.createElement("img");
  image.src = source; image.alt = caption || "Meme enviado pela turma";
  image.decoding = "async"; image.loading = "lazy"; image.draggable = false;
  figure.append(image); stage.append(figure); slides.push(figure);
  slideGroups.push([source]); MEME_COUNT = slideGroups.length;
  renderCarousel();
};
window.showLatestMeme = function () { current = MEME_COUNT - 1; renderCarousel(); startAuto(); };

