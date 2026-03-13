import { findNearby, getEntityDetail, categoryLabel, entityLink } from '../core/directory-api.js';
import { addEntityMarker, isEntityPinned } from '../map/entity-marker-manager.js';

const CATEGORY_COLORS = {
	artists: ['bg-purple-100', 'text-purple-700'],
	bands: ['bg-indigo-100', 'text-indigo-700'],
	venues: ['bg-red-100', 'text-red-700'],
	festivals: ['bg-amber-100', 'text-amber-700'],
	labels: ['bg-emerald-100', 'text-emerald-700'],
	producers: ['bg-cyan-100', 'text-cyan-700'],
	music_orgs: ['bg-slate-100', 'text-slate-600'],
	media: ['bg-rose-100', 'text-rose-600'],
};

const CATEGORY_FILTERS = ['all', 'artists', 'bands', 'venues', 'festivals', 'labels', 'producers'];

let currentCity = '';
let currentCountry = '';
let activeFilter = 'all';
let lastResults = [];
let expandedEntity = null;
let nearbyRequestVersion = 0;

function el(tag, classes, attrs) {
	const node = document.createElement(tag);
	if (classes) node.className = classes;
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (k === 'text') node.textContent = v;
			else node.setAttribute(k, v);
		}
	}
	return node;
}

function svgIcon(pathD, cls = 'w-3 h-3') {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('class', cls);
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('viewBox', '0 0 24 24');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('stroke-linecap', 'round');
	path.setAttribute('stroke-linejoin', 'round');
	path.setAttribute('stroke-width', '2');
	path.setAttribute('d', pathD);
	svg.appendChild(path);
	return svg;
}

export function setupNearbyPanel() {
	const container = document.getElementById('nearby-panel');
	if (!container) return { updateNearby: () => {} };

	return {
		async updateNearby(lat, lon, city, country) {
			const requestVersion = ++nearbyRequestVersion;
			currentCity = city || '';
			currentCountry = country || '';
			const results = await findNearby(lat, lon);
			if (requestVersion !== nearbyRequestVersion) return;
			lastResults = results;
			activeFilter = 'all';
			expandedEntity = null;
			render(container);
		},
	};
}

function render(container) {
	container.textContent = '';

	const filtered = activeFilter === 'all'
		? lastResults
		: lastResults.filter(r => r.category === activeFilter);

	const hasResults = filtered.length > 0;
	const wrapper = el('div', 'space-y-3');

	// Header
	const header = el('div', 'flex items-center justify-between');
	const title = el('h3', 'text-[10px] font-black text-slate-400 uppercase tracking-widest');
	title.textContent = hasResults ? `Nearby in ${currentCity || 'this area'}` : 'MINY Ecosystem';
	header.appendChild(title);
	if (hasResults) {
		const count = el('span', 'text-[9px] font-bold text-slate-300');
		count.textContent = `${lastResults.length} found`;
		header.appendChild(count);
	}
	wrapper.appendChild(header);

	// Category filters
	if (hasResults) {
		const available = new Set(lastResults.map(r => r.category));
		const filters = CATEGORY_FILTERS.filter(f => f === 'all' || available.has(f));
		if (filters.length > 2) {
			const filterRow = el('div', 'flex flex-wrap gap-1');
			filters.forEach(f => {
				const isActive = f === activeFilter;
					const btn = el('button', `nearby-filter px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-colors ${isActive ? 'bg-accent text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`);
					btn.setAttribute('type', 'button');
					btn.setAttribute('aria-label', `Filter nearby results by ${f === 'all' ? 'all categories' : categoryLabel(f)}`);
					btn.textContent = f === 'all' ? 'All' : categoryLabel(f) + 's';
				btn.addEventListener('click', () => {
					activeFilter = f;
					render(container);
				});
				filterRow.appendChild(btn);
			});
			wrapper.appendChild(filterRow);
		}
	}

	// Results or empty state
	if (hasResults) {
		const list = el('div', 'space-y-1.5 max-h-[280px] overflow-y-auto no-scrollbar');
		filtered.forEach(entity => list.appendChild(buildCard(entity, container)));
		wrapper.appendChild(list);
	} else {
		wrapper.appendChild(buildEmptyState());
	}

	// Ecosystem links
	wrapper.appendChild(buildEcosystemLinks());

	container.appendChild(wrapper);
}

function buildCard(entity, rootContainer) {
	const card = el('div', 'nearby-card group rounded-xl border border-slate-100 hover:border-slate-200 transition-colors overflow-hidden');

	const row = el('div', 'flex items-center gap-2.5 p-2.5 cursor-pointer');

	const info = el('div', 'flex-1 min-w-0');
	const nameRow = el('div', 'flex items-center gap-1.5');

	const nameSpan = el('span', 'text-[11px] font-bold text-slate-800 truncate');
	nameSpan.textContent = entity.name;
	nameRow.appendChild(nameSpan);

	const colors = CATEGORY_COLORS[entity.category] || ['bg-slate-100', 'text-slate-600'];
	const badge = el('span', `px-1.5 py-0.5 ${colors[0]} ${colors[1]} text-[7px] font-black uppercase tracking-wider rounded flex-shrink-0`);
	badge.textContent = categoryLabel(entity.category);
	nameRow.appendChild(badge);

	info.appendChild(nameRow);

	if (entity.location) {
		const loc = el('div', 'text-[9px] text-slate-400 mt-0.5 truncate');
		loc.textContent = entity.location;
		info.appendChild(loc);
	}

	row.appendChild(info);

	// Pin to map button
	const pinned = isEntityPinned(entity.id);
	const pinBtn = el('button', `flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors ${pinned ? 'bg-accent/10 text-accent' : 'text-slate-300 hover:text-accent hover:bg-slate-50'}`);
	pinBtn.setAttribute('type', 'button');
	pinBtn.setAttribute('aria-label', pinned ? `Remove ${entity.name} from map` : `Pin ${entity.name} to map`);
	pinBtn.title = pinned ? 'Remove from map' : 'Pin to map';
	pinBtn.appendChild(svgIcon(
		pinned
			? 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'
			: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
		`w-3.5 h-3.5 ${pinned ? 'fill-current stroke-current' : ''}`
	));
	pinBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		addEntityMarker(entity);
		render(rootContainer);
	});
	row.appendChild(pinBtn);

	row.appendChild(svgIcon('M9 5l7 7-7 7', `w-3.5 h-3.5 text-slate-300 group-hover:text-accent transition-colors flex-shrink-0 ${expandedEntity === entity.id ? 'rotate-90' : ''}`));
	card.appendChild(row);

	// Expanded detail area
	if (expandedEntity === entity.id) {
		const detailBox = el('div', 'px-2.5 pb-2.5');
		const loading = el('div', 'text-[9px] text-slate-400 animate-pulse');
			loading.textContent = 'Loading…';
		detailBox.appendChild(loading);
		card.appendChild(detailBox);

		loadEntityDetail(entity.name, detailBox);
	}

	card.addEventListener('click', () => {
		expandedEntity = expandedEntity === entity.id ? null : entity.id;
		render(rootContainer);
	});

	return card;
}

async function loadEntityDetail(entityName, detailEl) {
	const detail = await getEntityDetail(entityName);
	detailEl.textContent = '';

	if (!detail) {
		const msg = el('div', 'text-[9px] text-slate-400');
		msg.textContent = 'No details available';
		detailEl.appendChild(msg);
		return;
	}

	const inner = el('div', 'space-y-2 pt-1 border-t border-slate-50');

	// Bio
	if (detail.bio) {
		const bio = el('p', 'text-[10px] text-slate-500 leading-relaxed');
		bio.textContent = detail.bio.length > 120 ? detail.bio.slice(0, 120) + '...' : detail.bio;
		inner.appendChild(bio);
	}

	// Genre tags
	const genres = (detail.genre_tags || []).slice(0, 4);
	if (genres.length) {
		const tagRow = el('div', 'flex flex-wrap gap-1');
		genres.forEach(g => {
			const tag = el('span', 'px-1.5 py-0.5 bg-slate-50 text-[8px] font-medium text-slate-500 rounded');
			tag.textContent = g;
			tagRow.appendChild(tag);
		});
		inner.appendChild(tagRow);
	}

	// View on MINY link
	const link = el('a', 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/5 text-[9px] font-bold text-accent hover:bg-accent/10 transition-colors');
	link.href = entityLink(detail);
	link.target = '_blank';
	link.rel = 'noopener';
	const linkText = el('span');
	linkText.textContent = 'View on MINY';
	link.appendChild(linkText);
	link.appendChild(svgIcon('M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14', 'w-3 h-3'));
	link.addEventListener('click', (e) => e.stopPropagation());
	inner.appendChild(link);

	detailEl.appendChild(inner);
}

function buildEmptyState() {
	const city = currentCity || 'this city';
	const encodedCity = encodeURIComponent(currentCity || '');
	const encodedCountry = encodeURIComponent(currentCountry || '');
	const generatorUrl = `https://rapidconnect.minyvinyl.com/generator${encodedCity ? `?city=${encodedCity}&country=${encodedCountry}` : ''}`;

	const a = el('a', 'block p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 hover:border-accent/50 transition-colors group relative overflow-hidden');
	a.href = generatorUrl;
	a.target = '_blank';
	a.rel = 'noopener';

	const glow = el('div', 'absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity');
	a.appendChild(glow);

	const content = el('div', 'relative text-center space-y-2');

	const iconWrap = el('div', 'w-10 h-10 mx-auto rounded-xl bg-white/10 flex items-center justify-center');
	iconWrap.appendChild(svgIcon('M12 4v16m8-8H4', 'w-5 h-5 text-white/80'));
	content.appendChild(iconWrap);

	const textWrap = el('div');
	const headline = el('div', 'text-[11px] font-bold text-white');
	headline.textContent = `Be the first in ${city}`;
	const sub = el('div', 'text-[9px] text-slate-400 mt-0.5');
	sub.textContent = 'Create your EPK and claim your spot';
	textWrap.appendChild(headline);
	textWrap.appendChild(sub);
	content.appendChild(textWrap);

	const cta = el('div', 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-[9px] font-bold text-white/80 group-hover:bg-white/20 transition-colors');
	const ctaText = el('span');
	ctaText.textContent = 'Create EPK';
	cta.appendChild(ctaText);
	cta.appendChild(svgIcon('M9 5l7 7-7 7', 'w-3 h-3 group-hover:translate-x-0.5 transition-transform'));
	content.appendChild(cta);

	a.appendChild(content);
	return a;
}

function buildEcosystemLinks() {
	const row = el('div', 'flex gap-1.5 mt-2');

	const links = [
		{ href: 'https://minyfy.minyvinyl.com', label: 'Mixtapes', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z' },
		{ href: 'https://directory.minyvinyl.com', label: 'Directory', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
		{ href: 'https://rapidconnect.minyvinyl.com', label: 'EPK', icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0' },
	];

	links.forEach(({ href, label, icon }) => {
		const a = el('a', 'flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-accent/30 transition-colors group');
		a.href = href;
		a.target = '_blank';
		a.rel = 'noopener';
		a.appendChild(svgIcon(icon, 'w-3 h-3 text-slate-400 group-hover:text-accent transition-colors'));
		const txt = el('span', 'text-[8px] font-bold text-slate-400 group-hover:text-slate-600 uppercase tracking-wider');
		txt.textContent = label;
		a.appendChild(txt);
		row.appendChild(a);
	});

	return row;
}
