<template>
    <div
        v-if="airportInfo"
        class="__info-sections"
    >
        <div class="__grid-info-sections">
            <div class="__grid-info-sections_title">
                Name
            </div>
            <common-info-block
                :bottom-items="[airportInfo.name]"
                class="__grid-info-sections_content"
                :top-items="[airportInfo.icao, airportInfo.iata]"
            />
        </div>
        <div
            v-if="airportInfo.altitude_m"
            class="__grid-info-sections"
        >
            <div class="__grid-info-sections_title">
                Elevation
            </div>
            <common-info-block
                :bottom-items="[
                    `${ airportInfo.altitude_m } meters`,
                    `${ airportInfo.altitude_ft } feet`,
                ]"
                class="__grid-info-sections_content"
            />
        </div>
        <div
            v-if="airportInfo.transition_level"
            class="__grid-info-sections"
        >
            <div class="__grid-info-sections_title">
                Transition
            </div>
            <common-info-block
                :bottom-items="[airportInfo.transition_level?.toString(), airportInfo.transition_alt?.toString()]"
                class="__grid-info-sections_content"
                :top-items="['Level', 'Altitude']"
            />
        </div>
        <div class="__grid-info-sections">
            <div class="__grid-info-sections_title">
                Location
            </div>
            <common-info-block
                :bottom-items="[`Division ${ airportInfo.division_id }`]"
                class="__grid-info-sections_content"
                :top-items="[airportInfo.country, airportInfo.city]"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { injectAirport } from '~/composables/airport';
import CommonInfoBlock from '~/components/common/blocks/CommonInfoBlock.vue';

const data = injectAirport();

const airportInfo = computed(() => data.value.airport?.vatInfo);
</script>
