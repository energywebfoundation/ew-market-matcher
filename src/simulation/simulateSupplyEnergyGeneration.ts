import { ProducingAsset } from 'ew-asset-registry-lib';
import * as SchemaDefs from '../schema-defs/MatcherConf';
import { Supply } from 'ew-market-lib';
import { Currency, TimeFrame } from 'ew-utils-general-lib';
import { getMatcherConf, getAssetConf, getMarketConf, wait, getCurrentTime, getCurrentMinute as getCurrentMinutes } from './utils';

const matcherConf: SchemaDefs.IMatcherConf = getMatcherConf();

const PRODUCING_ASSET_ID: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.producingAssetId;
const SOLAR_ASSET_GENERATION_MAP: any[] = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.solarAssetGeneration.map;
const CHECK_INTERVAL: number = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.checkInterval;

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

    let minutes = -1;
    while (true) {
        let currentMinutes = getCurrentMinutes();

        if (minutes !== currentMinutes) {
            minutes = currentMinutes;

            const supplyEnergyGenerationTimeEntry = findCurrentTimeEntry();

            if (supplyEnergyGenerationTimeEntry) {
                const entryHours = supplyEnergyGenerationTimeEntry[0][0];
                const entryMinutes = supplyEnergyGenerationTimeEntry[0][1];
                const entryEnergy = Math.round(supplyEnergyGenerationTimeEntry[1]);
    
                let readingAmountToAdd = entryEnergy;
    
                console.log(`[SEGS]: Simulating time ${entryHours}:${entryMinutes || '00'} | Energy: ${Math.round(entryEnergy)}Wh`);
    
                if (readingAmountToAdd) {
                    if (entryMinutes === 0) {
                        const hourSupply = SOLAR_ASSET_GENERATION_MAP.filter(([[hour]]) => {
                            return entryHours === hour;
                        }).reduce((a, b) => a + Math.round(b[1]), 0);
    
                        if (hourSupply) {
                            await createSupply(hourSupply);
                        
                            /** 
                             * Might no longer be true:
                             * 
                             * For now demand matches certificate only if
                             * 
                             * demand.offChainProperties.targetWhPerPeriod
                             * 
                             * equals
                             * 
                             * certificate.powerInW
                             * 
                             */
    
                            // readingAmountToAdd = hourSupply;
                        }
                    }
    
                    const previousRead = await getProducingAssetSmartMeterRead();
    
                    await saveProducingAssetSmartMeterRead(previousRead + readingAmountToAdd);
                }
            }
        }

        await wait(CHECK_INTERVAL);
    }
})();