/* ===== common.js : shared by index.html, auth.html and dashboard.html ===== */
const $ = id => document.getElementById(id);
/*const store = {
	get u() {
		try {
			return JSON.parse(localStorage.getItem('f2v_users') || '{}')
		} catch (e) {
			return {}
		}
	},
	set u(v) {
		try {
			localStorage.setItem('f2v_users', JSON.stringify(v))
		} catch (e) {}
	}
};*/
let user = null;
/*try {
	user = sessionStorage.getItem('f2v_user') || null
} catch (e) {}*/
const PAGE = document.body.dataset.page;

/*function setSession(u) {
	user = u;
	try {
		sessionStorage.setItem('f2v_user', u)
	} catch (e) {}
}*/


async function logout(btn) {
	if (btn.disabled) return;
	btn.disabled = true;
	const originalText = btn.textContent;
    btn.textContent = 'Logging out...';
	user = null;
	await fetch('/api/logout', { method: 'POST' });
	window.location.href = '/';
}

/*fetch('/api/info')
  .then(res => res.json())
  .then(data => {
	if (data.logged_in) {
	  user=data.username;
	  renderNav();
	}
  });*/

async function init() {
	info = await (await fetch('/api/info')).json();
	if (info.logged_in) {
		//$('welcomeMsg').innerText = `Welcome, ${info.username}!`;
		user = info.username;
	}
	renderNav();
	view();
	//const selector = 'button, input[type="button"], input[type="submit"], input[type="reset"]';
	//document.querySelectorAll(selector).forEach(btn => btn.disabled = false);
}

/* ---------- navigation bar ---------- */
function renderNav() {
	const nav = $('nav');
	if (!nav) return;
	const act = c => c ? 'active' : '';
	const how = PAGE === 'home' && location.hash === '#how';
	if (!user) {
		nav.innerHTML = `<a class="logo" href="/">PixelVault</a>
      <div class="links"><a class="${act(PAGE === 'home' && !how)}" href="/">Home</a>
      <a class="${act(how)}" href="/#how">How it works</a>
      <a class="btn outline sm" href="/auth">Login</a></div>`;
	} else {
		const tab = document.body.dataset.tab || 'enc';
		nav.innerHTML = `<a class="logo" href="/dashboard">PixelVault</a>
      <div class="links"><a class="${act(PAGE === 'dashboard' && tab === 'enc')}" href="/dashboard#enc">Encode</a>
      <a class="${act(PAGE === 'dashboard' && tab === 'dec')}" href="/dashboard#dec">Decode</a>
      <a class="${act(how)}" href="/#how">How it works</a>
      <span class="user"><span class="avatar">${user[0].toUpperCase()}</span>${user}</span>
      <button class="btn sm" id="logoutbtn" onclick="logout(this)">Log out</button></div>`;
	}
}
init();
renderNav();
addEventListener('hashchange', renderNav);

/* ---------- helpers ---------- */
const fmt = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';
const pal = ['#22e8ec', '#1aa7b8', '#2e6f8a', '#1d4d68', '#7a73a8', '#5aa7d4', '#123552', '#22e8ec'];

/* ---------- effects ---------- */
// falling hex rain
(function () {
	const cv = $('rain');
	if (!cv) return;
	const cx = cv.getContext('2d');
	let cols, drops;
	const chars = '0123456789ABCDEF';

	function size() {
		cv.width = innerWidth;
		cv.height = innerHeight;
		cols = Math.ceil(innerWidth / 16);
		drops = Array(cols).fill(0).map(() => Math.random() * -50)
	}
	size();
	addEventListener('resize', size);
	setInterval(() => {
		cx.fillStyle = 'rgba(10,18,32,.12)';
		cx.fillRect(0, 0, cv.width, cv.height);
		cx.font = '14px monospace';
		drops.forEach((y, i) => {
			cx.fillStyle = Math.random() < .04 ? '#ffffff' : '#22e8ec';
			cx.fillText(chars[Math.random() * 16 | 0] + chars[Math.random() * 16 | 0], i * 16, y * 16);
			drops[i] = y * 16 > cv.height && Math.random() > .975 ? 0 : y + 1;
		});
	}, 60);
})();

// cursor pixel trail
let lastT = 0;
addEventListener('mousemove', e => {
	const n = Date.now();
	if (n - lastT < 35) return;
	lastT = n;
	const d = document.createElement('i');
	d.className = 'trail';
	d.style.left = e.clientX - 5 + 'px';
	d.style.top = e.clientY - 5 + 'px';
	d.style.background = pal[Math.random() * pal.length | 0];
	document.body.appendChild(d);
	setTimeout(() => d.remove(), 700);
});

// pixel burst
function burst(x, y) {
	for (let i = 0; i < 40; i++) {
		const d = document.createElement('i');
		d.className = 'burst';
		d.style.left = x + 'px';
		d.style.top = y + 'px';
		d.style.background = pal[Math.random() * pal.length | 0];
		document.body.appendChild(d);
		const a = Math.random() * Math.PI * 2,
			v = 80 + Math.random() * 220;
		d.animate([{
			transform: 'translate(0,0) scale(1)',
			opacity: 1
		}, {
			transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v + 80}px) scale(.1)`,
			opacity: 0
		}], {
			duration: 900 + Math.random() * 500,
			easing: 'cubic-bezier(.2,.8,.3,1)'
		}).onfinish = () => d.remove();
	}
}

// 3D tilt on cards
document.addEventListener('mousemove', e => {
	const c = e.target.closest && e.target.closest('.card:not(.pixels)');
	document.querySelectorAll('.card.tilt').forEach(x => {
		if (x !== c) {
			x.style.transform = '';
			x.classList.remove('tilt')
		}
	});
	if (!c) return;
	c.classList.add('tilt');
	const r = c.getBoundingClientRect(),
		px = (e.clientX - r.left) / r.width - .5,
		py = (e.clientY - r.top) / r.height - .5;
	c.style.transform = `perspective(700px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg)`;
});

// Konami code toggles rainbow mode
(function () {
	const k = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
	let i = 0;
	addEventListener('keydown', e => {
		i = e.keyCode === k[i] ? i + 1 : 0;
		if (i === k.length) {
			document.documentElement.classList.toggle('konami');
			i = 0
		}
	})
})();