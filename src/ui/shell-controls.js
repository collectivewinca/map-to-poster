const STORAGE_KEY = 'map-to-poster:chrome-hidden';

function isTypingTarget(target) {
	if (!target) return false;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function setupShellControls() {
	const body = document.body;
	const desktopToggle = document.getElementById('shell-toggle-desktop');
	const mobileToggle = document.getElementById('shell-toggle-mobile');
	const showControlsFab = document.getElementById('show-controls-fab');

	function setHidden(hidden) {
		body.classList.toggle('chrome-hidden', hidden);
		try {
			localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
		} catch (err) {
		}

		const desktopLabel = hidden ? 'Show controls' : 'Hide controls';
		const mobileLabel = desktopLabel;

		if (desktopToggle) {
			desktopToggle.setAttribute('aria-label', desktopLabel);
			const text = desktopToggle.querySelector('span');
			if (text) text.textContent = hidden ? 'Show' : 'Hide';
		}
		if (mobileToggle) mobileToggle.setAttribute('aria-label', mobileLabel);
		if (showControlsFab) showControlsFab.setAttribute('aria-label', 'Show controls');
	}

	function toggleHidden(force) {
		const next = typeof force === 'boolean' ? force : !body.classList.contains('chrome-hidden');
		setHidden(next);
	}

	[desktopToggle, mobileToggle].forEach((button) => {
		if (!button) return;
		button.addEventListener('click', () => toggleHidden());
	});

	if (showControlsFab) {
		showControlsFab.addEventListener('click', () => toggleHidden(false));
	}

	document.addEventListener('keydown', (event) => {
		if (event.defaultPrevented) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (isTypingTarget(event.target)) return;
		if (event.key.toLowerCase() !== 'h') return;
		event.preventDefault();
		toggleHidden();
	});

	let hidden = false;
	try {
		hidden = localStorage.getItem(STORAGE_KEY) === '1';
	} catch (err) {
	}
	setHidden(hidden);
}
