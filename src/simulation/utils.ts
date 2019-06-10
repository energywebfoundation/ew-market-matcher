import * as fs from 'fs';
import { createBlockchainProperties as assetCreateBlockchainProperties } from 'ew-asset-registry-lib';
import * as SchemaDefs from '../schema-defs/MatcherConf';
import { createBlockchainConf } from '../controller/BlockchainConnection';
import { createBlockchainProperties as marketCreateBlockchainProperties } from 'ew-market-lib';
import moment from 'moment-timezone';

export function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds)
    });
}

export function getMatcherConf() {
    return JSON.parse(
        fs.readFileSync('example-conf/production-conf.json', 'utf8').toString()
    );
}

const matcherConf = getMatcherConf();

const SOLAR_ASSET_GENERATION_TIMEZONE: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.solarAssetGeneration.timezone;
const SMART_METER_ADDRESS: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.smartMeterAddress;
const SMART_METER_PRIVATE_KEY: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.smartMeterPrivateKey;
const ASSET_OWNER_ADDRESS: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.assetOwnerAddress;
const ASSET_OWNER_PRIVATE_KEY: string = (matcherConf.dataSource as any).simulateSupplyEnergyGeneration.assetOwnerPrivateKey;

export async function getBlockchainConf() {
    return createBlockchainConf(
        matcherConf.dataSource as SchemaDefs.IBlockchainDataSource,
        (matcherConf.dataSource as SchemaDefs.IBlockchainDataSource).matcherAccount
    );
}

export async function getAssetConf()  {
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

export async function getMarketConf(
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

export function getCurrentTime() {
    return moment().tz(SOLAR_ASSET_GENERATION_TIMEZONE);;
}

export function getCurrentMinute() {
    return moment().tz(SOLAR_ASSET_GENERATION_TIMEZONE).minutes();
}