// Copyright 2018 Energy Web Foundation
// This file is part of the Origin Application brought to you by the Energy Web Foundation,
// a global non-profit organization focused on accelerating blockchain technology across the energy sector,
// incorporated in Zug, Switzerland.
//
// The Origin Application is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// This is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY and without an implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details, at <http://www.gnu.org/licenses/>.
//
// @authors: slock.it GmbH; Heiko Burkhardt, heiko.burkhardt@slock.it; Martin Kuechler, martin.kuchler@slock.it

import { ProducingAsset, ConsumingAsset } from 'ew-asset-registry-lib';
import {
    Certificate,
    createBlockchainProperties as issuerCreateBlockchainProperties
} from 'ew-origin-lib';
import { Configuration, ContractEventHandler, EventHandlerManager } from 'ew-utils-general-lib';
import {
    Agreement,
    Demand,
    Supply,
    createBlockchainProperties as marketCreateBlockchainProperties
} from 'ew-market-lib';
import { logger } from '../Logger';
import { Controller } from './Controller';
import Web3 from 'web3';
import { IBlockchainDataSource } from '../schema-defs/MatcherConf';
import { EthAccount } from 'ew-utils-general-lib/dist/js/blockchain-facade/Configuration';

export const initMatchingManager = async (controller: Controller, conf: Configuration.Entity) => {
    conf.logger.verbose('* Getting all porducing assets');
    const assetList = await ProducingAsset.getAllAssets(conf);
    assetList.forEach(async (asset: ProducingAsset.Entity) =>
        controller.registerProducingAsset(asset)
    );

    // conf.logger.verbose('* Getting all consuming assets');
    // const consumingAssetList = (await EwAsset.ConsumingAsset.getAllAssets(conf));
    // consumingAssetList.forEach(async (asset: EwAsset.ConsumingAsset.Entity) =>
    //     controller.registerConsumingAsset(asset as EwAsset.ConsumingAsset.Entity),
    // );

    conf.logger.verbose('* Getting all active agreements');
    const agreementListLength = await Agreement.getAgreementListLength(conf);
    for (let i = 0; i < agreementListLength; i++) {
        controller.registerAgreement(await new Agreement.Entity(i.toString(), conf).sync());
    }

    conf.logger.verbose('* Getting all active demands');
    const demandListLength = await Demand.getDemandListLength(conf);
    for (let i = 0; i < demandListLength; i++) {
        controller.registerDemand(await new Demand.Entity(i.toString(), conf).sync());
    }

    conf.logger.verbose('* Getting all active supplies');
    const supplyListLength = await Supply.getSupplyListLength(conf);
    for (let i = 0; i < supplyListLength; i++) {
        controller.registerSupply(await new Supply.Entity(i.toString(), conf).sync());
    }

    conf.logger.verbose('* Getting all certificates');
    const certificateListLength = await Certificate.getCertificateListLength(conf);
    for (let i = 0; i < certificateListLength; i++) {
        const newCertificate = await new Certificate.Entity(i.toString(), conf).sync();
        await controller.matchTrigger(newCertificate);
    }
};

export const createBlockchainConf = async (
    blockchainSectionConfFile: IBlockchainDataSource,
    matcherAccount: EthAccount
): Promise<Configuration.Entity> => {
    const web3 = new Web3(blockchainSectionConfFile.web3Url);
    const marketConf = await marketCreateBlockchainProperties(
        web3,
        blockchainSectionConfFile.marketContractLookupAddress
    );
    const originConf = await issuerCreateBlockchainProperties(
        web3,
        blockchainSectionConfFile.originContractLookupAddress
    );
    marketConf.certificateLogicInstance = originConf.certificateLogicInstance;
    marketConf.activeUser = matcherAccount;

    return {
        blockchainProperties: marketConf,
        logger,
        offChainDataSource: {
            baseUrl: blockchainSectionConfFile.offChainDataSourceUrl
        }
    };
};

export const initEventHandling = async (controller: Controller, conf: Configuration.Entity) => {
    const currentBlockNumber = await conf.blockchainProperties.web3.eth.getBlockNumber();
    const certificateContractEventHandler = new ContractEventHandler(
        conf.blockchainProperties.certificateLogicInstance,
        currentBlockNumber
    );

    certificateContractEventHandler.onEvent('LogCreatedCertificate', async (event: any) => {
        logger.verbose(
            'Event: LogCreatedCertificate certificate #' + event.returnValues._certificateId
        );
        const newCertificate = await new Certificate.Entity(
            event.returnValues._certificateId,
            conf
        ).sync();

        await controller.matchTrigger(newCertificate);
    });

    // certificateContractEventHandler.onEvent('LogCertificateOwnerChanged' , async (event) => {
    //
    //     if (matcherAddress === event.returnValues._oldEscrow && matcherAddress !== event.returnValues._newEscrow) {
    //         console.log('\n* Event: LogCertificateOwnerChanged certificate escrow changed certificate id: ' + event.returnValues._certificateId);
    //
    //         // cobntroller.removeCertificate(parseInt(event.returnValues._certificateId, 10))
    //     }
    //
    // });

    const marketContractEventHandler = new ContractEventHandler(
        conf.blockchainProperties.marketLogicInstance,
        currentBlockNumber
    );

    marketContractEventHandler.onEvent('createdNewDemand', async event => {
        console.log('\n* Event: createdNewDemand demand: ' + event.returnValues._demandId);
        const newDemand = await new Demand.Entity(event.returnValues._demandId, conf).sync();
        await controller.registerDemand(newDemand);
        // matchingManager.matchDemandWithCertificatesHoldInTrust(newDemand)
    });

    marketContractEventHandler.onEvent('createdNewSupply', async event => {
        console.log('\n* Event: createdNewSupply supply: ' + event.returnValues._supplyId);
        const newSupply = await new Supply.Entity(event.returnValues._supplyId, conf).sync();
        await controller.registerSupply(newSupply);
    });

    marketContractEventHandler.onEvent('LogAgreementFullySigned', async event => {
        console.log(
            `\n* Event: LogAgreementFullySigned - (Agreement, Demand, Supply) ID: (${
                event.returnValues._agreementId
            }, ${event.returnValues._demandId}, ${event.returnValues._supplyId})`
        );

        const newAgreement = await new Agreement.Entity(
            event.returnValues._agreementId,
            conf
        ).sync();
        await controller.registerAgreement(newAgreement);
    });

    // demandContractEventHandler.onEvent('LogDemandExpired', async (event) => {
    //     console.log('\n* Event: LogDemandExpired demand: ' + event.returnValues._demandId);
    //     controller.removeDemand(parseInt(event.returnValues._demandId, 10));
    //
    // });

    const assetContractEventHandler = new ContractEventHandler(
        conf.blockchainProperties.producingAssetLogicInstance,
        currentBlockNumber
    );

    // assetContractEventHandler.onEvent('LogNewMeterRead', (event) =>
    //     controller.match()
    // )

    assetContractEventHandler.onEvent('LogAssetFullyInitialized', async event => {
        console.log('\n* Event: LogAssetFullyInitialized asset: ' + event.returnValues._assetId);
        const newAsset = await new ProducingAsset.Entity(event.returnValues._assetId, conf).sync();
        await controller.registerProducingAsset(newAsset);
    });

    assetContractEventHandler.onEvent('LogAssetSetActive', async event => {
        console.log('\n* Event: LogAssetSetActive  asset: ' + event.returnValues._assetId);

        const asset = await new ProducingAsset.Entity(event.returnValues._assetId, conf).sync();
        await controller.registerProducingAsset(asset);
    });

    assetContractEventHandler.onEvent('LogAssetSetInactive', async event => {
        console.log('\n* Event: LogAssetSetInactive asset: ' + event.returnValues._assetId);

        await controller.removeProducingAsset(event.returnValues._assetId);
    });

    const consumingAssetContractEventHandler = new ContractEventHandler(
        conf.blockchainProperties.consumingAssetLogicInstance,
        currentBlockNumber
    );

    // consumingAssetContractEventHandler.onEvent('LogNewMeterRead', async (event) => {
    //     console.log('\n* Event: LogNewMeterRead consuming asset: ' + event.returnValues._assetId);
    //     const asset = await controller.createOrRefreshConsumingAsset(event.returnValues._assetId);
    //     console.log('*> Meter read: '  + asset.lastSmartMeterReadWh + ' Wh');
    //
    // });

    consumingAssetContractEventHandler.onEvent('LogAssetFullyInitialized', async event => {
        console.log(
            '\n* Event: LogAssetFullyInitialized consuming asset: ' + event.returnValues._assetId
        );
        const newAsset = await new ConsumingAsset.Entity(event.returnValues._assetId, conf).sync();
        await controller.registerConsumingAsset(newAsset);
    });

    consumingAssetContractEventHandler.onEvent('LogAssetSetActive', async event => {
        console.log('\n* Event: LogAssetSetActive consuming asset: ' + event.returnValues._assetId);

        const asset = await new ConsumingAsset.Entity(event.returnValues._assetId, conf).sync();
        await controller.registerConsumingAsset(asset);
    });

    consumingAssetContractEventHandler.onEvent('LogAssetSetInactive', async event => {
        console.log(
            '\n* Event: LogAssetSetInactive consuming asset: ' + event.returnValues._assetId
        );

        await controller.removeConsumingAsset(event.returnValues._assetId);
    });

    const eventHandlerManager = new EventHandlerManager(4000, conf);
    eventHandlerManager.registerEventHandler(consumingAssetContractEventHandler);
    eventHandlerManager.registerEventHandler(marketContractEventHandler);
    eventHandlerManager.registerEventHandler(assetContractEventHandler);
    eventHandlerManager.registerEventHandler(certificateContractEventHandler);
    eventHandlerManager.start();
};
