import fetch from 'node-fetch';
import * as SchemaDefs from '../schema-defs/MatcherConf';
import moment from 'moment-timezone';
import { Moment } from 'moment';
import { Demand } from 'ew-market-lib';
import { Currency, TimeFrame, AssetType } from 'ew-utils-general-lib';
import { getMarketConf, getMatcherConf, wait, getCurrentTime, getAssetConf } from './utils';
import { ConsumingAsset } from 'ew-asset-registry-lib';

const matcherConf: SchemaDefs.IMatcherConf = getMatcherConf();
const CHECK_INTERVAL: number = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.checkInterval;
const BUYER = {
    ADDRESS: '0xcea1c413a570654fa85e78f7c17b755563fec5a5',
    PRIVATE_KEY: '0x5c0b28bff67916a879953c50b25c73827ae0b777a2ad13abba2e4b67f843294e'
};

const CONSUMING_ASSET_SMART_METER = {
    ADDRESS: '0x1112ec367b20d2bffd40ee11523c3d36d61adf1b',
    PRIVATE_KEY: '0x50764e302e4ed8ce624003deca642c03ce06934fe77585175c5576723f084d4c'
};

async function createDemand(
    targetWhPerPeriod: number = 0,
    startTime: string = '0',
    endTime: string = '0',
    consumingAssetId: number = 0,
    producingAssetId: number = 0,
    timeframe: TimeFrame = TimeFrame.hourly,
    pricePerCertifiedWh: number = 0,
    currency: Currency = Currency.Euro
) {
    console.log('-----------------------------------------------------------');

    const conf = await getMarketConf(BUYER.ADDRESS, BUYER.PRIVATE_KEY);

    const demandOffchainProps: Demand.IDemandOffChainProperties = {
        timeframe,
        pricePerCertifiedWh,
        currency,
        productingAsset: producingAssetId,
        consumingAsset: consumingAssetId,
        locationCountry: '',
        locationRegion: '',
        assettype: AssetType.Solar,
        minCO2Offset: 0,
        otherGreenAttributes: '',
        typeOfPublicSupport: '',
        targetWhPerPeriod,
        startTime,
        endTime
    };

    const demandProps: Demand.IDemandOnChainProperties = {
        url: '',
        propertiesDocumentHash: '',
        demandOwner: BUYER.ADDRESS
    };

    try {
        const demand = await Demand.createDemand(
            demandProps,
            demandOffchainProps,
            conf
        );
        delete demand.proofs;
        delete demand.configuration;
        conf.logger.info(`Demand Created (ID: ${demand.id}) | ${targetWhPerPeriod}Wh | ${moment(startTime, 'x').format('HH:mm')} - ${moment(endTime, 'x').format('HH:mm')}`);
    } catch (e) {
        conf.logger.error('Demand could not be created\n' + e);
    }

    console.log('-----------------------------------------------------------\n');
}


async function queryServer(
    startTime: Moment,
    endTime: Moment
) {
    const TEST_RESPONSE = [
        {
          "page": 0,
          "previous": "string",
          "next": "string",
          "device_id": 0,
          "device": {
            "manufacturer": "string",
            "model": "string",
            "serial_number": "string",
            "latitude": "string",
            "longitude": "string",
            "energy_unity": "string",
            "is_accumulated": true
          },
          "measuredEnergy": [
            {
              "energy": 1,
              "measurement_time": 0
            }
          ]
        }
    ];

    return TEST_RESPONSE;

    const API_URL = `http://google.com/consumed/{deviceId}?limit=100&start=${startTime.toISOString()}&end=${endTime.toISOString()}`;

    const response = await fetch(API_URL);

    return await response.json();
}

function calculateEnergyFromResponse(response: any): number {
    let energy = 0;

    response.forEach((item) => {
        energy += item.measuredEnergy.reduce((a, b) => a + b.energy, 0);
    }); 

    return Math.round(energy);
}

async function getConsumingAssetSmartMeterRead(
    assetId: string = '0'
) {
    const conf = await getAssetConf();

    let asset = await new ConsumingAsset.Entity(assetId, conf).sync();

    return parseInt(asset.lastSmartMeterReadWh as any as string, 10);
}

async function addConsumingAssetSmartMeterRead(
    meterReading: number,
    assetId: string = '0'
) {
    console.log('-----------------------------------------------------------');

    meterReading += await getConsumingAssetSmartMeterRead();

    const conf = await getAssetConf(
        CONSUMING_ASSET_SMART_METER.ADDRESS,
        CONSUMING_ASSET_SMART_METER.PRIVATE_KEY
    );

    try {
        let asset = await new ConsumingAsset.Entity(assetId, conf).sync();

        await asset.saveSmartMeterRead(meterReading, '');
        asset = await asset.sync();
        conf.logger.verbose(`Consuming asset ${assetId} smart meter reading saved: ${meterReading}`);
    } catch (e) {
        conf.logger.error('Could not save smart meter reading for consuming asset\n' + e);
    }

    console.log('-----------------------------------------------------------\n');
}

async function fetchAndCreateDemand(
    startTime: Moment,
    endTime: Moment
) {
    const response = await queryServer(startTime, endTime);
    
    const energy = calculateEnergyFromResponse(response);

    if (energy) {
        await createDemand(
            energy,
            startTime.format('x'),
            endTime.format('x')
        );

        try {   
            await addConsumingAssetSmartMeterRead(energy);
        } catch (error) {
            console.error('error when trying to save consuming asset smart meter read', error);
        }
    }
}

function getHour() {
    return getCurrentTime().hours();
}

(async () => {
    console.log('Starting Demand Simulator');

    let hour = -1;
    while (true) {
        const currentHour = getHour();
        
        if (hour !== currentHour) {
            hour = currentHour;

            // create demand for past hour
            await fetchAndCreateDemand(
                moment().hours(currentHour - 1).minutes(0).seconds(0).milliseconds(0),
                moment().hours(currentHour - 1).minutes(59).seconds(59).milliseconds(999)
            );
        }

        await wait(CHECK_INTERVAL);
    }
})();