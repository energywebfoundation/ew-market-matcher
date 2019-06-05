import * as fs from 'fs';
import Web3 from 'web3';
import { assert } from 'chai';

import { Configuration, TimeFrame, Currency, AssetType, Compliance } from 'ew-utils-general-lib';
import { UserLogic, migrateUserRegistryContracts, buildRights, Role } from 'ew-user-registry-lib';
import { Certificate, CertificateLogic, migrateCertificateRegistryContracts } from 'ew-origin-lib';
import { migrateAssetRegistryContracts, AssetProducingRegistryLogic, ProducingAsset } from 'ew-asset-registry-lib';
import { MarketLogic, migrateMarketRegistryContracts, Demand, Supply, Agreement } from 'ew-market-lib';

import { logger } from '../Logger';
import { startMatcher } from '../exports';
import * as SchemaDefs from '../schema-defs/MatcherConf';

const PROVIDER_URL = 'http://localhost:8545';
const BACKEND_URL = 'http://localhost:3030';
const deployKey = 'd7410fb6e0c10ce73cc3179f73e7bb6adabbe8fb17570a47eb8195e17ed0c3f4';

describe('Test Matcher', async () => {
    const web3 = new Web3(PROVIDER_URL);

    const privateKeyDeployment = deployKey.startsWith('0x') ? deployKey : '0x' + deployKey;
    const accountDeployment = web3.eth.accounts.privateKeyToAccount(privateKeyDeployment).address;

    console.log('acc-deployment: ' + accountDeployment);
    let conf: Configuration.Entity;
    let userLogic: UserLogic;
    let assetProducingRegistry: AssetProducingRegistryLogic;
    let marketLogic: MarketLogic;
    let certificateLogic: CertificateLogic;

    let userContractLookupAddr;
    let assetContractLookupAddr;
    let originContractLookupAddr;
    let marketContractLookupAddr;

    let asset;

    const assetOwnerPK = '0xfaab95e72c3ac39f7c060125d9eca3558758bb248d1a4cdc9c1b7fd3f91a4485';
    const assetOwnerAddress = web3.eth.accounts.privateKeyToAccount(assetOwnerPK).address;

    const assetSmartmeterPK = '0x12c5c7473dbdb92a524a93baa14ded529fe29acef8d269a3901c14a15e2b0f98';
    const assetSmartmeter = web3.eth.accounts.privateKeyToAccount(assetSmartmeterPK).address;

    const traderPK = '0x2dc5120c26df339dbd9861a0f39a79d87e0638d30fdedc938861beac77bbd3f5';
    const accountTrader = web3.eth.accounts.privateKeyToAccount(traderPK).address;

    const matcherConf: SchemaDefs.IMatcherConf = {
        dataSource: {
            type: ('BLOCKCHAIN' as SchemaDefs.BlockchainDataSourceType),
            web3Url: PROVIDER_URL,
            offChainDataSourceUrl: BACKEND_URL,
            marketContractLookupAddress: '',
            originContractLookupAddress: '',
            matcherAccount: {
                address: accountDeployment,
                privateKey: privateKeyDeployment
            }
        },
        matcherSpecification: {
            type: ('CONFIGURABLE_REFERENCE' as SchemaDefs.MatcherType),
            matcherConfigFile: 'example-conf/simple-hierarchy-rule.json'
        }
    };

    it('should deploy user-registry contracts', async () => {
        const userContracts = await migrateUserRegistryContracts(web3, privateKeyDeployment);
        userContractLookupAddr = (userContracts as any).UserContractLookup;

        userLogic = new UserLogic(web3 as Web3, (userContracts as any).UserLogic);
        await userLogic.setUser(accountDeployment, 'admin', { privateKey: privateKeyDeployment });

        await userLogic.setRoles(accountDeployment, buildRights([
            Role.UserAdmin,
            Role.AssetAdmin,
            Role.AssetManager,
            Role.Trader,
            Role.Matcher
        ]), { privateKey: privateKeyDeployment });

        await userLogic.setUser(accountTrader, 'trader', { privateKey: privateKeyDeployment });
        await userLogic.setRoles(accountTrader, buildRights([
            Role.Trader
        ]), { privateKey: privateKeyDeployment });

        await userLogic.setUser(assetOwnerAddress, 'assetOwner', {
            privateKey: privateKeyDeployment
        });
        await userLogic.setRoles(assetOwnerAddress, buildRights([
            Role.AssetManager
        ]), { privateKey: privateKeyDeployment });
    }).timeout(5000);

    it('should deploy asset-registry contracts', async () => {
        const deployedContracts = await migrateAssetRegistryContracts(
            web3 as any,
            userContractLookupAddr,
            privateKeyDeployment
        );
        assetProducingRegistry = new AssetProducingRegistryLogic(
            web3 as any,
            (deployedContracts as any).AssetProducingRegistryLogic
        );
        assetContractLookupAddr = (deployedContracts as any).AssetContractLookup;
    });

    it('should deploy origin (issuer) contracts', async () => {
        const deployedContracts = await migrateCertificateRegistryContracts(
            web3 as any,
            assetContractLookupAddr,
            privateKeyDeployment
        );
        certificateLogic = new CertificateLogic(
            web3 as any,
            (deployedContracts as any).CertificateLogic
        );
        originContractLookupAddr = (deployedContracts as any).OriginContractLookup;
        (matcherConf.dataSource as SchemaDefs.IBlockchainDataSource).originContractLookupAddress = originContractLookupAddr;
    });

    it('should deploy market-registry contracts', async () => {
        const deployedContracts = await migrateMarketRegistryContracts(
            web3 as any,
            assetContractLookupAddr,
            privateKeyDeployment
        );
        marketLogic = new MarketLogic(web3 as any, (deployedContracts as any).MarketLogic);
        marketContractLookupAddr = (deployedContracts as any).MarketContractLookup;
        (matcherConf.dataSource as SchemaDefs.IBlockchainDataSource).marketContractLookupAddress = marketContractLookupAddr;
    });

    it('should create a demand', async () => {
        conf = {
            blockchainProperties: {
                activeUser: {
                    address: accountTrader,
                    privateKey: traderPK
                },
                userLogicInstance: userLogic,
                producingAssetLogicInstance: assetProducingRegistry,
                marketLogicInstance: marketLogic,
                certificateLogicInstance: certificateLogic,
                web3
            },
            offChainDataSource: {
                baseUrl: 'http://localhost:3030'
            },
            logger
        };

        const demandOffchainProps: Demand.IDemandOffChainProperties = {
            timeframe: TimeFrame.hourly,
            pricePerCertifiedWh: 10,
            currency: Currency.Ether,
            productingAsset: 0,
            consumingAsset: 0,
            locationCountry: 'string',
            locationRegion: 'string',
            assettype: AssetType.BiomassGas,
            minCO2Offset: 10,
            otherGreenAttributes: 'string',
            typeOfPublicSupport: 'string',
            targetWhPerPeriod: 10,
            registryCompliance: Compliance.EEC,
            startTime: '1559466472732',
            endTime: '1559466492732'
        };

        const demandProps: Demand.IDemandOnChainProperties = {
            url: null,
            propertiesDocumentHash: null,
            demandOwner: conf.blockchainProperties.activeUser.address
        };

        await Demand.createDemand(demandProps, demandOffchainProps, conf);
        assert.equal(await Demand.getDemandListLength(conf), 1);
    });

    it('should onboard an asset', async () => {
        conf.blockchainProperties.activeUser = {
            address: accountDeployment,
            privateKey: privateKeyDeployment
        };

        const assetProps: ProducingAsset.IOnChainProperties = {
            smartMeter: { address: assetSmartmeter },
            owner: { address: assetOwnerAddress },
            lastSmartMeterReadWh: 0,
            active: true,
            lastSmartMeterReadFileHash: 'lastSmartMeterReadFileHash',
            matcher: [{ address: accountDeployment }],
            propertiesDocumentHash: null,
            url: null,
            maxOwnerChanges: 3
        };

        const assetPropsOffChain: ProducingAsset.IOffChainProperties = {
            facilityName: 'MatcherTestFacility',
            operationalSince: 0,
            capacityWh: 10,
            country: 'USA',
            region: 'AnyState',
            zip: '012345',
            city: 'Anytown',
            street: 'Main-Street',
            houseNumber: '42',
            gpsLatitude: '0.0123123',
            gpsLongitude: '31.1231',
            assetType: ProducingAsset.Type.Wind,
            complianceRegistry: ProducingAsset.Compliance.EEC,
            otherGreenAttributes: '',
            typeOfPublicSupport: ''
        };

        asset = await ProducingAsset.createAsset(
            assetProps,
            assetPropsOffChain,
            conf
        );
        assert.equal(await ProducingAsset.getAssetListLength(conf), 1);
    });

    it('should onboard an supply', async () => {
        conf.blockchainProperties.activeUser = {
            address: assetOwnerAddress,
            privateKey: assetOwnerPK
        };

        await Supply.createSupply(
            {
                url: null,
                propertiesDocumentHash: null,
                assetId: 0
            },
            {
                price: 10,
                currency: Currency.USD,
                availableWh: 10,
                timeframe: TimeFrame.hourly
            },
            conf
        );

        assert.equal(await Supply.getSupplyListLength(conf), 1);
    });

    it('no certificate has been created', async () => {
        conf.blockchainProperties.activeUser = {
            address: accountTrader,
            privateKey: traderPK
        };
        assert.equal(await Certificate.getCertificateListLength(conf), 0);
    });

    it('starts the matcher', async () => {
        await startMatcher(matcherConf);

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        await sleep(5000);
    }).timeout(6000);

    it('sets the market lookup contract', async () => {
        conf.blockchainProperties.activeUser = {
            address: assetOwnerAddress,
            privateKey: assetOwnerPK
        };

        try {
            await conf.blockchainProperties.producingAssetLogicInstance.setMarketLookupContract(
                asset.id,
                originContractLookupAddr,
                { privateKey: assetOwnerPK }
            );
            conf.logger.info(`Certificates for Asset #${asset.id} initialized`);
        } catch (e) {
            conf.logger.error(`Could not initialize certificates\n${e}`);
        }
    });

    describe('Demand matching tests', () => {
        it('creates a smart meter reading', async () => {
            conf.blockchainProperties.activeUser = {
                address: assetSmartmeter,
                privateKey: assetSmartmeterPK
            };

            const producingAsset = await new ProducingAsset.Entity(asset.id, conf).sync();
            await producingAsset.saveSmartMeterRead(10, 'newMeterRead');
        });

        it('certificate has been created', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountTrader,
                privateKey: traderPK
            };
            assert.equal(await Certificate.getCertificateListLength(conf), 1);
        });

        it('certificate owner is the trader', async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            await sleep(10000);

            const certificate = await new Certificate.Entity('0', conf).sync();
            assert.equal(await certificate.getOwner(), accountTrader);
        }).timeout(11000);
    });

    describe('Agreement matching tests', () => {
        it('should create an agreement', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountTrader,
                privateKey: traderPK
            };

            const startTime = Math.floor(Date.now() / 1000);

            const agreementOffchainProps: Agreement.IAgreementOffChainProperties = {
                start: startTime,
                end: startTime + startTime,
                price: 10,
                currency: Currency.USD,
                period: 10,
                timeframe: TimeFrame.hourly
            };

            const matcherOffchainProps: Agreement.IMatcherOffChainProperties = {
                currentWh: 0,
                currentPeriod: 0
            };

            const agreementProps: Agreement.IAgreementOnChainProperties = {
                propertiesDocumentHash: null,
                url: null,
                matcherDBURL: null,
                matcherPropertiesDocumentHash: null,
                demandId: 0,
                supplyId: 0,
                allowedMatcher: []
            };

            await Agreement.createAgreement(
                agreementProps,
                agreementOffchainProps,
                matcherOffchainProps,
                conf
            );

            conf.blockchainProperties.activeUser = {
                address: assetOwnerAddress,
                privateKey: assetOwnerPK
            };

            const agreement: Agreement.Entity = await new Agreement.Entity('0', conf).sync();
            await agreement.approveAgreementSupply();
        }).timeout(6000);

        it('creates a smart meter reading', async () => {
            conf.blockchainProperties.activeUser = {
                address: assetSmartmeter,
                privateKey: assetSmartmeterPK
            };

            const producingAsset = await new ProducingAsset.Entity(asset.id, conf).sync();
            await producingAsset.saveSmartMeterRead(30, 'newMeterRead2');
        });

        it('certificate has been created', async () => {
            conf.blockchainProperties.activeUser = {
                address: accountTrader,
                privateKey: traderPK
            };
            assert.equal(await Certificate.getCertificateListLength(conf), 2);
        });

        it('a certificate has been split', async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            await sleep(5000);

            assert.equal(await Certificate.getCertificateListLength(conf), 4);
        }).timeout(6000);

        it('asset owner is still the owner of the original certificate', async () => {
            const certificate = await new Certificate.Entity('1', conf).sync();
            assert.equal(await certificate.getOwner(), assetOwnerAddress);
        });

        it('trader is owner of the split certificates', async () => {
            const certificate1 = await new Certificate.Entity('2', conf).sync();
            assert.equal(await certificate1.getOwner(), accountTrader);

            const certificate2 = await new Certificate.Entity('3', conf).sync();
            assert.equal(await certificate2.getOwner(), accountTrader);
        });
    });
});
