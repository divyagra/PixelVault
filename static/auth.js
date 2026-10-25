/* ===== auth.js : login + create account ===== */
// already logged in -> straight to the dashboard

function show(which) {
	$('login').classList.toggle('on', which === 'login');
	$('signup').classList.toggle('on', which === 'signup');
	history.replaceState(null, '', which === 'signup' ? '#signup' : location.pathname);
}
if (location.hash === '#signup') show('signup');

function enterDashboard() {
	burst(innerWidth / 2, innerHeight / 2);
	setTimeout(() => location.href = '/dashboard', 700);
}

function view(){
	if (user) enterDashboard();
}

async function doLogin(btn) {
	if (btn.disabled) return;
	btn.disabled = true;
	const originalText = btn.textContent;
	btn.textContent = 'Logging in...';
	const u = $('lu').value.trim(), p = $('lp').value;
	if (!u || !p) { $('lmsg').textContent = '> enter username and password'; return }
	$('lmsg').textContent = '';
	const res = await fetch('/api/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			username: u,
			password: p
		})
	});
	const data = await res.json();
	if (data.success) {
		enterDashboard();
	} else {
		alert(data.message);
		btn.disabled = false;
		btn.textContent = originalText;
	}
}

async function doSignup(btn) {
	if (btn.disabled) return;
	btn.disabled = true;
	const originalText = btn.textContent;
	btn.textContent = 'Registering and Logging in...';
	const u = $('su').value.trim(), p = $('sp').value, c = $('sc').value;
	if (!u || !p) { $('smsg').textContent = '> fill in all fields'; return }
	if (p !== c) { $('smsg').textContent = '> passwords do not match'; return }
	$('smsg').textContent = '';
	const res = await fetch('/api/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			username: u,
			password: p,
		})
	});
	const data = await res.json();
	if (data.success) {
		enterDashboard();
	}else{
		alert(data.message);
		btn.disabled = false;
		btn.textContent = originalText;
	}
}

['lp', 'lu'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && doLogin($("loginButton"))));
['sp', 'sc'].forEach(i => $(i).addEventListener('keydown', e => e.key === 'Enter' && doSignup($("registerButton"))));
$('sc').addEventListener('input', () => { $('smsg').textContent = ($('sc').value && $('sc').value !== $('sp').value) ? '> passwords do not match' : '' });
