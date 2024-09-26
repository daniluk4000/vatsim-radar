import type { PartialRecord } from '~/types/index';
import type { VatsimShortenedPrefile } from '~/types/data/vatsim';
import type { Coordinate } from 'ol/coordinate';

export interface MapAirport {
    icao: string;
    iata?: string;
    isPseudo: boolean;
    isSimAware: boolean;
    aircraft: Partial<{
        groundDep: number[];
        groundArr: number[];
        prefiles: number[];
        departures: number[];
        arrivals: number[];
    }>;
}

export type MapAircraftKeys = keyof MapAirport['aircraft'];
export type MapAircraftList = MapAirport['aircraft'];
export type MapAircraftMode = 'all' | 'ground' | MapAircraftKeys;

export type MapAircraft =
    PartialRecord<keyof Pick<MapAirport['aircraft'], 'groundDep' | 'groundArr' | 'prefiles'>, VatsimShortenedPrefile[]>
    & PartialRecord<keyof Pick<MapAirport['aircraft'], 'departures' | 'arrivals'>, boolean>;

export type MapWeatherLayer = 'PR0' | 'WND' | 'CL' | 'rainViewer';
export type MapLayoutLayerCarto = 'carto';
export type MapLayoutLayerCartoVariants = `${ MapLayoutLayerCarto }${ 'Vector' | 'Static' }`;
export type MapLayoutLayerExternal = 'OSM' | 'Satellite' | `${ MapLayoutLayerCartoVariants }Labels` | `${ MapLayoutLayerCartoVariants }NoLabels`;
export type MapLayoutLayer = MapLayoutLayerExternal | MapLayoutLayerCarto;
export type MapLayoutLayerExternalOptions = MapLayoutLayerExternal | MapLayoutLayerCarto;
export type MapLayoutLayerWithOptions = MapLayoutLayerExternalOptions;

export interface UserLayersTransparencySettings {
    satellite?: number;
    osm?: number;
    weatherDark?: number;
    weatherLight?: number;
}

interface IUserLocalSettings {
    location: Coordinate;
    zoom: number;

    filters: {
        opened?: boolean;
        layers?: {
            weather2?: MapWeatherLayer | false;
            layer?: MapLayoutLayerWithOptions;
            layerLabels?: boolean;
            layerVector?: boolean;
            transparencySettings?: UserLayersTransparencySettings;
        };
    };

    traffic: {
        disableFastUpdate?: boolean;
        showTotalDeparturesInFeaturedAirports?: boolean;
        vatglassesLevel?: number | boolean;
    };

    tutorial: {
        mapAirportPopupDepartureCount: boolean;
    };
}

export type UserLocalSettings = Partial<IUserLocalSettings>;
