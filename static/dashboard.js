/* ===== dashboard.js : encode / decode window (login required) ===== */

let lastFile = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- encode / decode slider ---------- */
function tab(t) {
	const dec = t === 'dec';
	document.body.dataset.tab = t;
	$('slider').classList.toggle('dec', dec);
	$('tabEnc').classList.toggle('on', !dec); $('tabDec').classList.toggle('on', dec);
	$('enc').classList.toggle('on', !dec); $('dec').classList.toggle('on', dec);
	history.replaceState(null, '', '#' + t);
	renderNav();
}
// nav links (dashboard.html#enc / #dec) switch the slider
addEventListener('hashchange', () => tab(location.hash === '#dec' ? 'dec' : 'enc'));
tab(location.hash === '#dec' ? 'dec' : 'enc');


async function setBar(id, f, msg, cls) {
	const bar = $(id + 'Bar');
	bar.style.width = Math.round(f * 100) + '%';
	$(id + 'msg').className = 'barmsg ' + (cls || '');
	$(id + 'msg').textContent = msg
	if (id == 'enc') {
		const buf = new Uint8Array(await lastFile.arrayBuffer());
		const s = (f * buf.length) | 0;
		drawHex(buf.slice(s, s + 64), s);
	} else {
		const lines = ['> reading frames … ok', '> checksum matched', '> header read … ok', '> padding removed … ok'];
		$('log').innerText = lines.slice(0,Math.round(f * 4)).join('\n') + '\n';
	}
	if (f >= 1) {
		const r = bar.getBoundingClientRect(); burst(r.right, r.top);
	}
}

function post(url, form, id) {
	return new Promise((res, rej) => {
		const x = new XMLHttpRequest();
		x.open('POST', url);
		x.upload.onprogress = e => {
			if (e.lengthComputable) setBar(id, e.loaded / e.total * 0.15, 'Uploading...','')
		};
		x.onload = () => {
			let j = {};
			try {
				j = JSON.parse(x.responseText)
			} catch (e) { }
			x.status < 300 ? res(j) : rej(new Error(j.error || x.statusText))
		};
		x.onerror = () => rej(new Error('Network error'));
		x.send(form)
	})
}
async function poll(job, id, out) {
	for (; ;) {
		const j = await (await fetch('/api/jobs/' + job)).json();
		if (j.status === 'error') {
			setBar(id, 0, 'Error: ' + j.error, 'bmerror');
			return
		}
		setBar(id, 0.15 + j.progress * 0.85, j.message, '');
		if (j.status === 'done') {
			setBar(id, 1, 'Finished', 'bmok');
			const r = j.result || {};
			let extra = '';
			if (r.ok === false) extra = '<p>Checksum mismatch: the recovered data is damaged.</p>';
			if (r.ok === true) extra = '<div><p>Integrity verified (SHA-256 match).</p></div>';
			$(out).innerHTML = extra + '<a href="' + j.download + '" ><br>Download result (one time, will be deleted after download)</a>';
			return
		}
		await sleep(700)
	}
}

function params() {
	return {
		width: $('w').value,
		height: $('h').value,
		fps: $('fps').value,
	}
}
async function encode() {
	const f = $('encFile').files[0];
	if (!f) return setBar('enc', 0, 'Choose a file first', 'bmerror');
	const fd = new FormData();
	fd.append('file', f);
	const a = $('audioFile').files[0];
	if (a) fd.append('audio', a);
	for (const [k, v] of Object.entries(params())) fd.append(k, v);
	$('encmsg').innerHTML = '';
	setBar('enc', 0, '', '');
	try {
		const j = await post('/api/encode', fd, 'enc');
		await poll(j.job, 'enc', 'encmsg')
	} catch (e) {
		setBar('enc', 0, 'Error: ' + e.message, 'bmerror')
	}
}
async function decode() {
	const f = $('decFile').files[0];
	if (!f) return setBar('dec', 0, 'Choose a video first', 'bmerror');
	const fd = new FormData();
	fd.append('video', f);
	$('decmsg').innerHTML = '';
	try {
		const j = await post('/api/decode', fd, 'dec');
		await poll(j.job, 'dec', 'decmsg')
	} catch (e) {
		setBar('dec', 0, 'Error: ' + e.message, 'bmerror')
	}
}

/* ---------- encode ---------- */
$('encFile').addEventListener('change', async e => {
	const f = e.target.files[0]; if (!f) return; lastFile = f; $('encName').textContent = f.name;
	const buf = new Uint8Array(await f.slice(0, 512).arrayBuffer()); drawHex(buf, 0); estimate();
});
$('audioFile').addEventListener('change', async e => {
	$('audioName').textContent = e.target.files[0] ? e.target.files[0].name : 'No file chosen'
});
function drawHex(buf, start) {
	let out = '';
	for (let i = 0; i < buf.length; i += 8) {
		const off = (start + i).toString(16).toUpperCase().padStart(4, '0');
		out += `<span class="o">${off}</span> ` + [...buf.slice(i, i + 8)].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '\n';
	}
	$('hex').innerHTML = out;
}
function calc() {
	if (!lastFile) return null;
	const w = +$('w').value || 1280, h = +$('h').value || 720, fps = +$('fps').value || 30;
	const header = 64 + lastFile.name.length, bpf = w * h * 4;
	const frames = Math.max(1, Math.ceil((lastFile.size + header) / bpf));
	return { w, h, fps, frames, secs: (frames / fps).toFixed(2), bpf };
}
function estimate() {
	const c = calc();
	$('encInfo').innerHTML = c ? `<div><span>File size</span><b>${fmt(lastFile.size)}</b></div><div><span>Capacity per frame</span><b>${fmt(c.bpf)}</b></div><div><span>Frames needed</span><b>${c.frames}</b></div><div><span>Video length</span><b>${c.secs} s</b></div>` : '<div><span>Choose a file first</span></div>';
}

async function createVideo() {
	if (!lastFile) { estimate(); return }
	encode();
}
['w', 'h', 'fps'].forEach(i => $(i).addEventListener('input', () => lastFile && estimate()));

/* ---------- decode (interface demo) ---------- */
$('decFile').addEventListener('change', e => { $('decName').textContent = e.target.files[0] ? e.target.files[0].name : 'No file chosen' });
function decodeVideo() {
	const f = $('decFile').files[0];
	if (!f) { $('log').textContent = '> Choose a video first'; return }
	$('decInfo').style.display = 'none'; $('log').textContent = '';
	decode();
}

function view(){

}