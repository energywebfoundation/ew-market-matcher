import * as fs from 'fs';
import { ProducingAsset, createBlockchainProperties as assetCreateBlockchainProperties } from 'ew-asset-registry-lib';
import * as SchemaDefs from './schema-defs/MatcherConf';
import { createBlockchainConf } from './controller/BlockchainConnection';
import moment from 'moment';
import { Supply, createBlockchainProperties as marketCreateBlockchainProperties } from 'ew-market-lib';
import { Currency, TimeFrame } from 'ew-utils-general-lib';

const matcherConf: SchemaDefs.IMatcherConf = JSON.parse(
    fs.readFileSync('example-conf/production-conf.json', 'utf8').toString()
);

const PRODUCING_ASSET_ID: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.producingAssetId;
const SMART_METER_ADDRESS: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.smartMeterAddress;
const SMART_METER_PRIVATE_KEY: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.smartMeterPrivateKey;
const ASSET_OWNER_ADDRESS: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.assetOwnerAddress;
const ASSET_OWNER_PRIVATE_KEY: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.assetOwnerPrivateKey;
const SOLAR_ASSET_GENERATION_HOURS_MAP: number[] = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.solarAssetGenerationHoursMap;
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

async function getMarketConf()  {
    const conf = await getBlockchainConf();

    conf.blockchainProperties = await marketCreateBlockchainProperties(
        conf.logger,
        conf.blockchainProperties.web3,
        (matcherConf.dataSource as any).marketContractLookupAddress
    );

    conf.blockchainProperties.activeUser = {
        address: ASSET_OWNER_ADDRESS,
        privateKey: ASSET_OWNER_PRIVATE_KEY
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
        conf.logger.info('Onboarded Supply ID: ' + supply.id);
    } catch (e) {
        conf.logger.error('Could not onboard a supply\n' + e);
    }

    console.log('-----------------------------------------------------------\n');
}

function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    });
}

function getCurrentHour() {
    return moment().hour();
}

(async () => {
    let hour = -1;

    while (true) {
        const newHour = getCurrentHour();

        if (hour !== newHour) {
            hour = newHour;

            const readingAmountToAdd = SOLAR_ASSET_GENERATION_HOURS_MAP[hour];
    
            if (readingAmountToAdd) {
                const previousRead = await getProducingAssetSmartMeterRead();

                await createSupply(readingAmountToAdd);
                await saveProducingAssetSmartMeterRead(previousRead + readingAmountToAdd);
            }
        }

        await wait(CHECK_INTERVAL);
    }
})();