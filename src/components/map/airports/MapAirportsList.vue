<template>
    <map-airport
        v-for="({airport, aircrafts, localAtc, arrAtc, features}, index) in getAirportsList"
        :key="airport.icao + index + (airport.iata ?? 'undefined')"
        :airport="airport"
        :aircrafts="aircrafts"
        :is-visible="visibleAirports.length < 100"
        :local-atc="localAtc"
        :arr-atc="arrAtc"
        :hovered-id="((airport.iata ? airport.iata === hoveredAirport : airport.icao === hoveredAirport) && hoveredId) ? hoveredId : null"
        :hovered-pixel="hoveredPixel"
        :gates="getAirportsGates.find(x => x.airport === airport.icao)?.gates"
        :features
        @manualHover="[isManualHover = true, hoveredAirport = airport.iata || airport.icao]"
        @manualHide="[isManualHover = false, hoveredAirport = null]"
    />
</template>

<script setup lang="ts">
import VectorSource from 'ol/source/Vector';
import type { ShallowRef } from 'vue';
import type { Map, MapBrowserEvent } from 'ol';
import { Feature } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import { attachMoveEnd, isPointInExtent } from '~/composables';
import type { MapAircraft, MapAirport as MapAirportType } from '~/types/map';

import type { VatsimShortenedAircraft, VatsimShortenedController, VatsimShortenedPrefile } from '~/types/data/vatsim';
import type { NavigraphGate } from '~/types/data/navigraph';
import { Point } from 'ol/geom';
import { Fill, Style, Text } from 'ol/style';
import { adjustPilotLonLat, checkIsPilotInGate } from '~/utils/shared/vatsim';
import { useMapStore } from '~/store/map';
import MapAirport from '~/components/map/airports/MapAirport.vue';
import type { Coordinate } from 'ol/coordinate';
import type { GeoJSONFeature } from 'ol/format/GeoJSON';
import type { VatSpyData } from '~/types/data/vatspy';

let vectorLayer: VectorLayer<any>;
const vectorSource = shallowRef<VectorSource | null>(null);
provide('vector-source', vectorSource);
const map = inject<ShallowRef<Map | null>>('map')!;
const dataStore = useDataStore();
const mapStore = useMapStore();
const visibleAirports = shallowRef<{
    vatspyAirport: VatSpyData['airports'][0],
    vatsimAirport: MapAirportType,
}[]>([]);
const airportsGates = shallowRef<{ airport: string, gates: NavigraphGate[] }[]>([]);
const originalGates = shallowRef<NavigraphGate[]>([]);
const isManualHover = ref(false);

const hoveredAirport = ref<string | null>(null);
const hoveredPixel = ref<Coordinate | null>(null);
const hoveredId = ref<string | null>(null);

function handlePointerMove(e: MapBrowserEvent<any>) {
    const features = map.value!.getFeaturesAtPixel(e.pixel, {
        hitTolerance: 5,
        layerFilter: layer => layer === vectorLayer,
    });

    let isInvalid = features.length !== 1 || (features[0].getProperties().type !== 'circle' && features[0].getProperties().type !== 'tracon');

    if (!isInvalid) {
        const airport = getAirportsList.value.find(x => (features[0].getProperties().iata || x.airport.iata) ? x.airport.iata === features[0].getProperties().iata : x.airport.icao === features[0].getProperties().icao);
        const pixel = map.value!.getCoordinateFromPixel(e.pixel);
        if (features[0].getProperties().type !== 'tracon') {
            isInvalid = pixel[1] - airport!.airport.lat < 80000;
        }
    }

    if (isInvalid || !mapStore.canShowOverlay) {
        if (!isManualHover.value) {
            hoveredAirport.value = null;
            hoveredPixel.value = null;
        }
        if (mapStore.mapCursorPointerTrigger === 2) mapStore.mapCursorPointerTrigger = false;
        return;
    }

    if (isManualHover.value) return;
    isManualHover.value = false;

    if (!hoveredPixel.value) {
        hoveredPixel.value = map.value!.getCoordinateFromPixel(e.pixel);
    }

    hoveredId.value = features[0].getProperties().id;
    hoveredAirport.value = features[0].getProperties().iata || features[0].getProperties().icao;
    mapStore.mapCursorPointerTrigger = 2;
}

watch(map, (val) => {
    if (!val) return;

    let hasLayer = false;
    val.getLayers().forEach((layer) => {
        if (hasLayer) return;
        hasLayer = layer.getProperties().type === 'airports';
    });
    if (hasLayer) return;

    if (!vectorLayer) {
        vectorSource.value = new VectorSource({
            features: [],
            wrapX: false,
        });

        vectorLayer = new VectorLayer({
            source: vectorSource.value,
            zIndex: 5,
            properties: {
                type: 'airports',
            },
        });
    }

    val.addLayer(vectorLayer);
    val.on('pointermove', handlePointerMove);
}, {
    immediate: true,
});

onBeforeUnmount(() => {
    if (vectorLayer) map.value?.removeLayer(vectorLayer);
    map.value?.un('pointermove', handlePointerMove);
});

const getAirportsGates = computed<typeof airportsGates['value']>(() => {
    if (!airportsGates.value || mapStore.zoom < 13) return [];

    return getAirportsList.value.map((airport) => {
        const gateAirport = airportsGates.value.find(x => x.airport === airport.airport.icao);
        if (!gateAirport) return null;

        const gates: NavigraphGate[] = gateAirport.gates;

        for (const pilot of [...airport.aircrafts.groundDep ?? [], ...airport.aircrafts.groundArr ?? []] as VatsimShortenedAircraft[]) {
            if (pilot.callsign === 'QAC3404') {
                const correct = adjustPilotLonLat(pilot);
                console.log(pilot.heading);
                const feature = new Feature({
                    geometry: new Point(correct),
                });

                feature.setStyle(new Style({
                    text: new Text({
                        font: '12px Arial',
                        text: 'Here!',
                        fill: new Fill({
                            color: '#3B6CEC',
                        }),
                    }),
                }));

                vectorSource.value?.addFeature(feature);

                setTimeout(() => {
                    vectorSource.value?.removeFeature(feature);
                    feature.dispose();
                }, 5000);
            }

            checkIsPilotInGate(pilot, gates);
        }

        return {
            airport: gateAirport.airport,
            gates,
        };
    }).filter(x => !!x) as typeof airportsGates['value'];
});

export interface AirportTraconFeature {
    id: string
    traconFeature: GeoJSONFeature,
    controllers: VatsimShortenedController[],
}

function getTraconPrefixes(tracon: GeoJSONFeature): string[] {
    if (typeof tracon.properties?.prefix === 'string') return [tracon.properties.prefix];

    if (typeof tracon.properties?.prefix === 'object' && Array.isArray(tracon.properties.prefix)) return tracon.properties.prefix;

    return [];
}

const getAirportsList = computed(() => {
    const facilities = useFacilitiesIds();
    const airports = visibleAirports.value.map(({ vatsimAirport, vatspyAirport }) => ({
        aircrafts: {} as MapAircraft,
        aircraftsList: vatsimAirport.aircrafts,
        aircraftsCids: Object.values(vatsimAirport.aircrafts).flatMap(x => x),
        airport: vatspyAirport,
        localAtc: [] as VatsimShortenedController[],
        arrAtc: [] as VatsimShortenedController[],
        features: [] as AirportTraconFeature[],
    }));

    function addToAirportSector(sector: GeoJSONFeature, airport: typeof airports[0], controller: VatsimShortenedController) {
        const id = JSON.stringify(sector.properties);
        let existingSector = airport.features.find(x => x.id === id);
        if (existingSector) existingSector.controllers.push(controller);
        else {
            existingSector = {
                id,
                traconFeature: sector,
                controllers: [controller],
            };

            airport.features.push(existingSector);
        }

        return existingSector;
    }

    for (const pilot of dataStore.vatsim.data.pilots.value) {
        const foundAirports = airports.filter(x => x.aircraftsCids.includes(pilot.cid));
        if (!foundAirports.length) continue;

        for (const airport of foundAirports) {
            if (airport.aircraftsList.departures?.includes(pilot.cid) && !airport.aircrafts.departures) airport.aircrafts.departures = true;
            if (airport.aircraftsList.arrivals?.includes(pilot.cid) && !airport.aircrafts.arrivals) airport.aircrafts.arrivals = true;

            if (airport.aircraftsList.groundArr?.includes(pilot.cid)) {
                if (!airport.aircrafts.groundArr) {
                    airport.aircrafts.groundArr = [pilot];
                }
                else {
                    (airport.aircrafts.groundArr as VatsimShortenedAircraft[]).push(pilot);
                }
            }

            if (airport.aircraftsList.groundDep?.includes(pilot.cid)) {
                if (!airport.aircrafts.groundDep) {
                    airport.aircrafts.groundDep = [pilot];
                }
                else {
                    (airport.aircrafts.groundDep as VatsimShortenedAircraft[]).push(pilot);
                }
            }
        }
    }

    for (const pilot of dataStore.vatsim.data.prefiles.value) {
        const airport = airports.find(x => x.aircraftsCids.includes(pilot.cid));
        if (!airport) continue;

        if (airport.aircraftsList.prefiles?.includes(pilot.cid)) {
            if (!airport.aircrafts.prefiles) {
                airport.aircrafts.prefiles = [pilot];
            }
            else {
                (airport.aircrafts.prefiles as VatsimShortenedPrefile[]).push(pilot);
            }
        }
    }

    for (const atc of dataStore.vatsim.data.locals.value) {
        const airport = airports.find(x => (x.airport.iata || atc.airport.iata) ? x.airport.iata === atc.airport.iata : x.airport.icao === atc.airport.icao);
        const icaoOnlyAirport = airports.find(x => atc.airport.isPseudo && atc.airport.iata && x.airport.icao === atc.airport.icao);
        if (!airport) continue;

        const isArr = !atc.isATIS && atc.atc.facility === facilities.APP;
        if (isArr) {
            airport.arrAtc.push(atc.atc);
            continue;
        }

        const isLocal = atc.isATIS || atc.atc.facility === facilities.DEL || atc.atc.facility === facilities.TWR || atc.atc.facility === facilities.GND;
        if (isLocal) (icaoOnlyAirport || airport).localAtc.push(atc.atc);
    }

    //Strict check
    for (const sector of dataStore.simaware.value?.data.features ?? []) {
        const airport = airports.find(x => x.airport.iata === sector.properties?.id || x.airport.icao === sector.properties?.id);
        if (!airport?.arrAtc.length) continue;

        const prefixes = getTraconPrefixes(sector);

        for (const controller of airport.arrAtc) {
            const splittedCallsign = controller.callsign.split('_');

            if (
                //Match AIRPORT_TYPE_NAME
                prefixes.includes(splittedCallsign.slice(0, 2).join('_')) ||
                //Match AIRPORT_NAME
                (splittedCallsign.length === 2 && prefixes.includes(splittedCallsign[0])) ||
                //Match AIRPORT_TYPERANDOMSTRING_NAME
                (splittedCallsign.length === 3 && prefixes.some(x => x.split('_').length === 2 && controller.callsign.startsWith(x)))
            ) {
                addToAirportSector(sector, airport, controller);
            }
        }
    }

    //Non-strict check
    for (const sector of dataStore.simaware.value?.data.features ?? []) {
        const airport = airports.find(x => x.airport.iata === sector.properties?.id || x.airport.icao === sector.properties?.id);
        if (!airport?.arrAtc.length) continue;

        const prefixes = getTraconPrefixes(sector);
        const id = JSON.stringify(sector.properties);

        //Only non found
        for (const controller of airport.arrAtc.filter(x => !airport.features.some(y => y.controllers.some(y => y.cid === x.cid)))) {
            if (prefixes.some(x => controller.callsign.startsWith(x))) {
                addToAirportSector(sector, airport, controller);
            }
        }

        //Still nothing found
        if (!airport.features.length) {
            airport.features.push({
                id,
                traconFeature: sector,
                controllers: airport.arrAtc,
            });
        }
    }

    return airports;
});

async function setVisibleAirports() {
    const extent = mapStore.extent.slice();
    extent[0] -= 100000;
    extent[1] -= 100000;
    extent[2] += 100000;
    extent[3] += 100000;

    //@ts-expect-error
    visibleAirports.value = dataStore.vatsim.data.airports.value.map((x) => {
        const airport = dataStore.vatspy.value!.data.airports.find(y => x.iata ? y.iata === x.iata : y.icao === x.icao)!;
        if (!airport) return null;
        const coordinates = [airport.lon, airport.lat];

        return isPointInExtent(coordinates, extent)
            ? {
                vatspyAirport: airport,
                vatsimAirport: x,
            }
            : null;
    }).filter(x => !!x) ?? [];

    if ((map.value!.getView().getZoom() ?? 0) > 13) {
        if (!visibleAirports.value.every(x => airportsGates.value.some(y => y.airport === x.vatsimAirport.icao))) {
            originalGates.value = (await Promise.all(visibleAirports.value.map(x => $fetch(`/data/navigraph/gates/${ x }`)))).flatMap(x => x ?? []);
        }

        airportsGates.value = await Promise.all(visibleAirports.value.map((airport) => {
            const gatesWithPixel = originalGates.value.filter(x => x.airport_identifier === airport.vatsimAirport.icao).map(x => ({
                ...x,
                pixel: map.value!.getPixelFromCoordinate([x.gate_longitude, x.gate_latitude]),
            }));

            return {
                airport: airport.vatsimAirport.icao,
                gates: gatesWithPixel.filter((x, xIndex) => !gatesWithPixel.some((y, yIndex) => yIndex < xIndex && (Math.abs(y.pixel[0] - x.pixel[0]) < 15 && Math.abs(y.pixel[1] - x.pixel[1]) < 15))),
            };
        }));
    }
}

attachMoveEnd(setVisibleAirports);

watch(dataStore.vatsim.updateTimestamp, () => {
    setVisibleAirports();
}, {
    immediate: true,
});
</script>