const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
const header = document.querySelector(".site-header");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => nav.classList.remove("open"));
  });
}

window.addEventListener("scroll", () => {
  if (!header) return;
  if (window.scrollY > 24) header.classList.add("compact");
  else header.classList.remove("compact");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("reveal-in");
    });
  },
  { threshold: 0.18 }
);

document.querySelectorAll("[data-reveal], [data-stagger]").forEach((el) => {
  observer.observe(el);
});
