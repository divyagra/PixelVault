/* ===== index.js : home page only ===== */
const pix = $('pix');
for (let i = 0; i < 54; i++) {
	pix.appendChild(document.createElement('b'))
}
const cells = [...pix.children];
const shuffle = () => cells.forEach(c => c.style.background = pal[Math.random() * pal.length | 0]);
shuffle();
setInterval(() => {
	for (let i = 0; i < 6; i++) cells[Math.random() * cells.length | 0].style.background = pal[Math.random() * pal.length | 0]
}, 500);

// click the pixel art to scramble it
pix.addEventListener('click', e => {
	shuffle();
	burst(e.clientX, e.clientY)
});

/* ---------- home <-> how it works (one visible at a time) ---------- */
function view() {
	const how = location.hash === '#how';
	$('home').classList.toggle('on', !how);
	$('how').classList.toggle('on', how);
	window.scrollTo(0, 0);
	if (user) {
		document.querySelectorAll(".loginb").forEach(btn => btn.innerHTML = `<a class="btn primary loginb" href="/dashboard">Go to Dashboard</a>`);
	}
}
addEventListener('hashchange', view);
view();