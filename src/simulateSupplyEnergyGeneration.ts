import * as fs from 'fs';
import { ProducingAsset, createBlockchainProperties as assetCreateBlockchainProperties } from 'ew-asset-registry-lib';
import * as SchemaDefs from './schema-defs/MatcherConf';
import { createBlockchainConf } from './controller/BlockchainConnection';
import moment from 'moment-timezone';
import { Demand, Supply, createBlockchainProperties as marketCreateBlockchainProperties } from 'ew-market-lib';
import { Currency, TimeFrame, AssetType } from 'ew-utils-general-lib';

const matcherConf: SchemaDefs.IMatcherConf = JSON.parse(
    fs.readFileSync('example-conf/production-conf.json', 'utf8').toString()
);

/**
 * @TODO
 * 
 * EACH 1 HOUR first hit the API endpoint for Wirepass and createDemand
 * 
 * then createSupply
 * 
 * then saveSmartMeterRead
 */

const PRODUCING_ASSET_ID: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.producingAssetId;
const SMART_METER_ADDRESS: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.smartMeterAddress;
const SMART_METER_PRIVATE_KEY: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.smartMeterPrivateKey;
const ASSET_OWNER_ADDRESS: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.assetOwnerAddress;
const ASSET_OWNER_PRIVATE_KEY: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.assetOwnerPrivateKey;
const BUYER = {
    ADDRESS: '0xcea1c413a570654fa85e78f7c17b755563fec5a5',
    PRIVATE_KEY: '0x5c0b28bff67916a879953c50b25c73827ae0b777a2ad13abba2e4b67f843294e'
};
const SOLAR_ASSET_GENERATION_MAP: any[] = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.solarAssetGeneration.map;
const SOLAR_ASSET_GENERATION_TIMEZONE: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.solarAssetGeneration.timezone;
const CHECK_INTERVAL: number = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.checkInterval;

async function getBlockchainConf() {
    return createBlockchainConf(
        matcherConf.dataSource as SchemaDefs.IBlockchainDataSource,
        (matcherConf.dataSource as SchemaDefs.IBlockchainDataSource).matcherAccount
    );
}

async function getAssetConf()  {
    const conf = await getBlockchainConf();

    conf.blockchainProperties = await assetCreateBlockchainProperties(
        conf.logger,
        conf.blockchainProperties.web3,
        (matcherConf.dataSource as any).assetContractLookupAddress
    );

    conf.blockchainProperties.activeUser = {
        address: SMART_METER_ADDRESS,
        privateKey: SMART_METER_PRIVATE_KEY
    };

    return conf;
}

async function getMarketConf(
    accountAddress = ASSET_OWNER_ADDRESS,
    accountPrivateKey = ASSET_OWNER_PRIVATE_KEY
)  {
    const conf = await getBlockchainConf();

    conf.blockchainProperties = await marketCreateBlockchainProperties(
        conf.logger,
        conf.blockchainProperties.web3,
        (matcherConf.dataSource as any).marketContractLookupAddress
    );

    conf.blockchainProperties.activeUser = {
        address: accountAddress,
        privateKey: accountPrivateKey
    };

    return conf;
}

async function getProducingAssetSmartMeterRead(
    assetId: string = PRODUCING_ASSET_ID
) {
    const conf = await getAssetConf();

    let asset = await new ProducingAsset.Entity(assetId, conf).sync();

    return parseInt(asset.lastSmartMeterReadWh as any as string, 10);
}

async function saveProducingAssetSmartMeterRead(
    meterReading: number,
    assetId: string = PRODUCING_ASSET_ID
) {
    console.log('-----------------------------------------------------------');

    const conf = await getAssetConf();

    try {
        let asset = await new ProducingAsset.Entity(assetId, conf).sync();
        await asset.saveSmartMeterRead(meterReading, '');
        asset = await asset.sync();
        conf.logger.verbose(`Producing asset ${assetId} smart meter reading saved: ${meterReading}`);
    } catch (e) {
        conf.logger.error('Could not save smart meter reading for producing asset\n' + e);
    }

    console.log('-----------------------------------------------------------\n');
}

async function createSupply(
    availableWh: number = 0,
    assetId: string = PRODUCING_ASSET_ID,
    timeframe: TimeFrame = TimeFrame.hourly,
    price: number = 0,
    currency: Currency = Currency.Euro
) {
    const conf = await getMarketConf();

    const supplyOffChainProperties: Supply.ISupplyOffchainProperties = {
        price,
        currency,
        availableWh,
        timeframe
    };

    const supplyProps: Supply.ISupplyOnChainProperties = {
        url: '',
        propertiesDocumentHash: '',
        assetId: parseInt(assetId, 0)
    };

    try {
        const supply = await Supply.createSupply(
            supplyProps,
            supplyOffChainProperties,
            conf
        );
        delete supply.proofs;
        delete supply.configuration;
        conf.logger.info(`Onboarded Supply (ID: ${supply.id}) | Energy: ${availableWh}Wh`);
    } catch (e) {
        conf.logger.error('Could not onboard a supply\n' + e);
    }

    console.log('-----------------------------------------------------------\n');
}

async function createDemand(
    targetWhPerPeriod: number = 0,
    startTime: string = '0',
    endTime: string = '0',
    consumingAssetId: number = 0,
    producingAssetId: number = Number(PRODUCING_ASSET_ID),
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

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    });
}

function getCurrentTime() {
    return moment().tz(SOLAR_ASSET_GENERATION_TIMEZONE);;
}

let i = 0;
function simulatedFindCurrentTimeEntry() {
    if (i === SOLAR_ASSET_GENERATION_MAP.length - 1) {
        i = 0;
    } else {
        i++;
    }

    return SOLAR_ASSET_GENERATION_MAP[i];
}

function findCurrentTimeEntry() {
    const now = getCurrentTime();

    return SOLAR_ASSET_GENERATION_MAP.find(([[hour, minute]]) => {
        return now.hours() === hour && now.minutes() === minute;
    });
}

(async () => {
    console.log('Starting Supply Energy Generation Simulator');

    while (true) {
        const entry = findCurrentTimeEntry();

        if (entry) {
            const entryHours = entry[0][0];
            const entryMinutes = entry[0][1];
            const entryEnergy = Math.round(entry[1]);

            let readingAmountToAdd = entryEnergy;

            console.log(`[SEGS]: Simulating time ${entryHours}:${entryMinutes || '00'} | Energy: ${Math.round(entryEnergy)}Wh`);

            if (readingAmountToAdd) {
                if (entryMinutes === 0) {
                    const hourSupply = SOLAR_ASSET_GENERATION_MAP.filter(([[hour]]) => {
                        return entryHours === hour;
                    }).reduce((a, b) => a + Math.round(b[1]), 0);

                    if (hourSupply) {
                        await createSupply(hourSupply);
                        await createDemand(
                            hourSupply,
                            moment().minutes(0).seconds(0).milliseconds(0).format('x'),
                            moment().minutes(59).seconds(59).milliseconds(999).format('x')
                        );

                        /** 
                         * For now demand matches certificate only if
                         * 
                         * demand.offChainProperties.targetWhPerPeriod
                         * 
                         * equals
                         * 
                         * certificate.powerInW
                         * 
                         */

                        readingAmountToAdd = hourSupply;
                    }

                    const previousRead = await getProducingAssetSmartMeterRead();

                    await saveProducingAssetSmartMeterRead(previousRead + readingAmountToAdd);
                }

                
            }
        }

        await wait(CHECK_INTERVAL);
    }
})();