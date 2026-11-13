// LocalFlow site: the booth demo and the download counter.
const RELEASES_REPO = "Ryan-Loofy/localflow-app";

/* ---------- The booth: one clock drives the lamp, the needle and the words. ---------- */
(function booth() {
  const lamp = document.querySelector(".lamp");
  if (!lamp) return;
  const strip = document.querySelector(".strip");
  const raw = document.querySelector(".raw");
  const state = document.querySelector(".state");
  const stateText = state.querySelector("span");
  const needle = document.getElementById("needle");
  const key = document.querySelector(".key");
  const words = Array.from(raw.querySelectorAll(".w"));

  // Timeline in seconds. Talking runs 0.25 to 3.6; transcribing takes the real median 0.9 s.
  const T_ON = 0.25, T_TALK_END = 3.6, T_STOP = 3.75, T_LAND = 4.65;
  const wordAt = words.map((_, i) => T_ON + 0.15 + (i / words.length) * (T_TALK_END - T_ON - 0.2));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let start = null, raf = null, running = false;

  function setState(s, text) {
    if (state.dataset.s === s) return;
    state.dataset.s = s;
    stateText.textContent = text;
  }

  // Speech-shaped level: syllable bursts with small pauses, silent outside the talk window.
  function level(t) {
    if (t < T_ON || t > T_TALK_END) return 0;
    const syll = Math.abs(Math.sin(t * 13.1)) * 0.55 + Math.abs(Math.sin(t * 5.3 + 1.2)) * 0.35;
    const breath = (Math.sin(t * 1.7) > 0.92) ? 0.15 : 1;
    return Math.min(1, syll * breath + 0.05);
  }

  let needleAngle = -48;
  function frame(now) {
    if (start === null) start = now;
    const t = (now - start) / 1000;
    lamp.classList.toggle("on", t >= T_ON && t < T_STOP);
    words.forEach((w, i) => w.classList.toggle("said", t >= wordAt[i]));
    if (t < T_ON) setState("idle", "Ready");
    else if (t < T_STOP) setState("rec", "Recording · hands-free");
    else if (t < T_LAND) setState("work", "Transcribing…");
    else setState("done", "Pasted");
    strip.classList.toggle("landed", t >= T_LAND);
    key.classList.toggle("down", (t >= 0 && t < 0.2) || (t >= T_STOP - 0.15 && t < T_STOP + 0.05));
    // Ballistic needle: fast rise, slower fall, like a real VU movement.
    const target = -48 + level(t) * 92;
    needleAngle += (target - needleAngle) * (target > needleAngle ? 0.35 : 0.12);
    needle.style.transform = `rotate(${needleAngle}deg)`;
    if (t < T_LAND + 0.4 || Math.abs(needleAngle + 48) > 0.3) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function showEnd() {
    words.forEach(w => w.classList.add("said"));
    strip.classList.add("landed");
    setState("done", "Pasted");
  }

  function run() {
    if (reduce) { showEnd(); return; }
    if (running) return;
    running = true;
    start = null;
    strip.classList.remove("landed");
    words.forEach(w => w.classList.remove("said"));
    raf = requestAnimationFrame(frame);
  }

  // Until the demo first plays, show the finished take rather than an empty strip.
  showEnd();
  key.addEventListener("click", run);
  document.addEventListener("keydown", e => {
    if (e.key === "CapsLock" || e.code === "CapsLock") run();
  });
  // macOS sends only keyup when Caps Lock turns off, so listen for both.
  document.addEventListener("keyup", e => {
    if (e.key === "CapsLock" || e.code === "CapsLock") run();
  });
  // Play once when the booth first comes into view.
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(run, 600); }
  }, { threshold: 0.5 });
  io.observe(lamp);
})();

/* ---------- Download counts from GitHub releases (downloads, not people). ---------- */
(async function counts() {
  const total = document.getElementById("count-total");
  if (!total) return;
  const latest = document.getElementById("count-latest");
  const latestLabel = document.getElementById("count-latest-label");
  const releasesCount = document.getElementById("count-releases");
  const table = document.getElementById("versions");
  const note = document.getElementById("count-note");
  const fmt = n => n.toLocaleString("en-US");
  const box = total.closest(".counts");
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=100`);
    if (!res.ok) throw new Error(String(res.status));
    const releases = (await res.json()).filter(r => !r.draft);
    const rows = releases.map(r => ({
      tag: r.tag_name,
      date: new Date(r.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      n: r.assets.filter(a => a.name.endsWith(".dmg")).reduce((s, a) => s + a.download_count, 0),
    }));
    const sum = rows.reduce((s, r) => s + r.n, 0);
    if (!rows.length) { note.textContent = "Counts appear here once the first release is published."; return; }
    total.textContent = fmt(sum);
    box.hidden = false;
    releasesCount.textContent = fmt(rows.length);
    if (rows.length) {
      latest.textContent = fmt(rows[0].n);
      latestLabel.textContent = `Downloads of ${rows[0].tag}`;
      const body = table.querySelector("tbody");
      rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.tag}</td><td>${r.date}</td><td class="num">${fmt(r.n)}</td>`;
        body.appendChild(tr);
      });
      table.hidden = false;
    }
  } catch {
    note.textContent = "Download counts are unavailable right now.";
  }
})();

/* ---------- Copy buttons for Terminal commands. ---------- */
document.querySelectorAll(".copy").forEach(btn => {
  btn.addEventListener("click", async () => {
    const text = document.getElementById(btn.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; }
    catch { btn.textContent = "Select and copy"; }
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  });
});
