import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

let artisticAdded = [];

class MockMapLibreMarker {
	constructor({ element }) {
		this.element = element;
		this.removed = false;
	}
	setLngLat(coords) {
		this.coords = coords;
		return this;
	}
	addTo(map) {
		this.map = map;
		artisticAdded.push(this);
		return this;
	}
	on() {
		return this;
	}
	remove() {
		this.removed = true;
		return this;
	}
}

function leafletMarker() {
	return {
		addTo() { return this; },
		on() { return this; },
		remove() { this.removed = true; return this; },
		setLatLng() { return this; },
		setLatLngs() { return this; },
		setStyle() { return this; },
	};
}

const leafletMock = {
	divIcon: vi.fn((config) => config),
	marker: vi.fn(() => leafletMarker()),
	polyline: vi.fn(() => leafletMarker()),
};

vi.mock('leaflet', () => ({
	...leafletMock,
	default: leafletMock,
}));

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('async guard behavior', () => {
	beforeEach(() => {
		vi.resetModules();
		artisticAdded = [];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('ignores stale route geometry responses', async () => {
		const state = {
			routeStartLat: 1,
			routeStartLon: 2,
			routeEndLat: 3,
			routeEndLon: 4,
			routeViaPoints: [],
			routeGeometry: [],
		};
		const updateState = vi.fn((partial) => Object.assign(state, partial));
		const first = deferred();
		const second = deferred();
		const fetchOSRMRoute = vi.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);

		vi.doMock('../src/core/state.js', () => ({
			state,
			updateState,
			getSelectedTheme: () => ({ route: '#ef4444', background: '#ffffff' }),
			getSelectedArtisticTheme: () => ({ route: '#ef4444', bg: '#000000' }),
		}));
		vi.doMock('../src/core/routing.js', () => ({ fetchOSRMRoute }));
		vi.doMock('../src/map/map-init.js', () => ({
			getMap: () => null,
			getArtisticMap: () => null,
			loadMapLibreModule: vi.fn(),
		}));

		const { updateRouteGeometry } = await import('../src/map/route-manager.js');

		const firstCall = updateRouteGeometry();
		state.routeViaPoints = [{ lat: 9, lon: 9 }];
		const secondCall = updateRouteGeometry();

		second.resolve([[20, 10], [21, 11]]);
		await secondCall;

		first.resolve([[99, 99], [100, 100]]);
		await firstCall;

		expect(updateState).toHaveBeenCalledTimes(1);
		expect(updateState).toHaveBeenCalledWith({ routeGeometry: [[20, 10], [21, 11]] });
		expect(state.routeGeometry).toEqual([[20, 10], [21, 11]]);
	});

	it('ignores stale nearby panel responses', async () => {
		const dom = new JSDOM('<div id="nearby-panel"></div>');
		vi.stubGlobal('window', dom.window);
		vi.stubGlobal('document', dom.window.document);
		vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
		vi.stubGlobal('Node', dom.window.Node);

		const first = deferred();
		const second = deferred();
		const findNearby = vi.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);

		vi.doMock('../src/core/directory-api.js', () => ({
			findNearby,
			getEntityDetail: vi.fn().mockResolvedValue(null),
			categoryLabel: (cat) => cat,
			entityLink: () => 'https://example.com/entity',
		}));
		vi.doMock('../src/map/entity-marker-manager.js', () => ({
			addEntityMarker: vi.fn(),
			isEntityPinned: vi.fn().mockReturnValue(false),
		}));

		const { setupNearbyPanel } = await import('../src/ui/nearby-panel.js');
		const { updateNearby } = setupNearbyPanel();

		const firstCall = updateNearby(1, 2, 'Jakarta', 'Indonesia');
		const secondCall = updateNearby(3, 4, 'Tokyo', 'Japan');

		second.resolve([{ id: 'tokyo-1', name: 'Tokyo Venue', category: 'venues', location: 'Tokyo' }]);
		await secondCall;

		first.resolve([{ id: 'jakarta-1', name: 'Jakarta Venue', category: 'venues', location: 'Jakarta' }]);
		await firstCall;

		const panelText = dom.window.document.getElementById('nearby-panel').textContent;
		expect(panelText).toContain('Nearby in Tokyo');
		expect(panelText).toContain('Tokyo Venue');
		expect(panelText).not.toContain('Jakarta Venue');
	});

	it('drops stale artistic marker creation from older render passes', async () => {
		const dom = new JSDOM('<!doctype html><html><body></body></html>');
		vi.stubGlobal('window', dom.window);
		vi.stubGlobal('document', dom.window.document);
		vi.stubGlobal('DOMParser', dom.window.DOMParser);

		vi.doMock('../src/map/map-init.js', () => ({
			getMap: () => ({ id: 'leaflet-map' }),
			getArtisticMap: () => ({ id: 'artistic-map' }),
			loadMapLibreModule: () => Promise.resolve({ Marker: MockMapLibreMarker }),
		}));
		vi.doMock('../src/core/state.js', () => ({
			state: {},
			updateState: vi.fn(),
			getSelectedTheme: () => ({ route: '#ef4444', textColor: '#111827' }),
			getSelectedArtisticTheme: () => ({ route: '#22c55e', text: '#f8fafc' }),
		}));

		const { updateMarkerStyles, getArtisticMarkers } = await import('../src/map/marker-manager.js');

		updateMarkerStyles({
			showMarker: true,
			renderMode: 'artistic',
			markerIcon: 'pin',
			markerSize: 1,
			markers: [{ lat: 1, lon: 2 }],
		});
		updateMarkerStyles({
			showMarker: true,
			renderMode: 'artistic',
			markerIcon: 'pin',
			markerSize: 1,
			markers: [{ lat: 5, lon: 6 }],
		});

		await flushMicrotasks();

		expect(artisticAdded).toHaveLength(1);
		expect(getArtisticMarkers()).toHaveLength(1);
		expect(artisticAdded[0].coords).toEqual([6, 5]);
	});

	it('drops stale artistic entity marker creation from older render passes', async () => {
		const dom = new JSDOM('<!doctype html><html><body><div id="poster-container"></div></body></html>');
		vi.stubGlobal('window', dom.window);
		vi.stubGlobal('document', dom.window.document);
		vi.stubGlobal('DOMParser', dom.window.DOMParser);
		vi.stubGlobal('requestAnimationFrame', (cb) => cb());
		vi.doUnmock('../src/map/entity-marker-manager.js');

		vi.doMock('../src/map/map-init.js', () => ({
			getMap: () => ({ id: 'leaflet-map' }),
			getArtisticMap: () => ({ id: 'artistic-map' }),
			loadMapLibreModule: () => Promise.resolve({ Marker: MockMapLibreMarker }),
		}));
		vi.doMock('../src/core/state.js', () => ({
			state: { entityMarkers: [] },
			updateState: vi.fn(),
			getSelectedTheme: () => ({ textColor: '#111827', background: '#ffffff' }),
			getSelectedArtisticTheme: () => ({ text: '#f8fafc', bg: '#020617' }),
		}));

		const { updateEntityMarkers } = await import('../src/map/entity-marker-manager.js');

		updateEntityMarkers({
			showEntityMarkers: true,
			showEntityLegend: false,
			renderMode: 'artistic',
			entityMarkers: [{ id: 'a', name: 'Old Entity', category: 'artists', lat: 1, lon: 2 }],
		});
		updateEntityMarkers({
			showEntityMarkers: true,
			showEntityLegend: false,
			renderMode: 'artistic',
			entityMarkers: [{ id: 'b', name: 'New Entity', category: 'venues', lat: 7, lon: 8 }],
		});

		await flushMicrotasks();

		expect(artisticAdded).toHaveLength(1);
		expect(artisticAdded[0].coords).toEqual([8, 7]);
	});
});
