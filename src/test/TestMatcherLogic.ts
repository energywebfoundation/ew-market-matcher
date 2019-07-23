import { assert } from 'chai';
import { mock, instance, when, spy, reset } from 'ts-mockito';

import { Configuration } from 'ew-utils-general-lib';
import { Certificate } from 'ew-origin-lib';
import { Demand, Agreement, Supply } from 'ew-market-lib';

import {
    findMatchingDemandsForCertificate,
    findMatchingCertificatesForDemand,
    findMatchingAgreementsForCertificate,
    findMatchingSuppliesForDemand
} from '../matcher/MatcherLogic';

describe('Test Matcher Logic', async () => {
    const mockedConfiguration: Configuration.Entity = mock(Configuration.Entity);
    const conf: Configuration.Entity = instance(mockedConfiguration);

    describe('findMatchingDemandsForCertificate', async () => {
        it('matches only when demand matches certificate', async () => {
            const testCertificate = {
                powerInW: 1e6,
                onChainDirectPurchasePrice: 150
            };

            const testDemands = [
                // Both checks should fail
                {
                    targetWhPerPeriod: 1.5e6,
                    maxPricePerMwh: 100
                },
                // Wh check should fail
                {
                    targetWhPerPeriod: 1e5,
                    maxPricePerMwh: 100
                },
                // Price check should fail
                {
                    targetWhPerPeriod: 1.5e6,
                    maxPricePerMwh: 200
                },
                // Both checks should pass
                {
                    targetWhPerPeriod: 1e5,
                    maxPricePerMwh: 200
                }
            ];

            const numShouldMatch = 1;

            const mockedCertificate: Certificate.Entity = mock(Certificate.Entity);
            when(mockedCertificate.powerInW).thenReturn(testCertificate.powerInW);
            when(mockedCertificate.onChainDirectPurchasePrice).thenReturn(testCertificate.onChainDirectPurchasePrice);

            const certificate: Certificate.Entity = instance(mockedCertificate);
            const demandsToTest = [];

            for (const demand of testDemands) {
                const mockedDemand: Demand.Entity = mock(Demand.Entity);
                when(mockedDemand.offChainProperties).thenReturn(demand);
                const demandInstance: Demand.Entity = instance(mockedDemand);
                demandsToTest.push(demandInstance);
            }

            const matchedDemands = await findMatchingDemandsForCertificate(certificate, conf, demandsToTest);
            assert.lengthOf(matchedDemands, numShouldMatch);
        });
    });

    describe('findMatchingCertificatesForDemand', async () => {
        it('matches only when certificate matches demand', async () => {
            const testDemand = {
                targetWhPerPeriod: 1e6,
                maxPricePerMwh: 150
            };

            const testCertificates = [
                // Both checks should fail
                {
                    powerInW: 0.9e6,
                    onChainDirectPurchasePrice: 200
                },
                // Wh check should fail
                {
                    powerInW: 1.1e6,
                    onChainDirectPurchasePrice: 200
                },
                // Price check should fail
                {
                    powerInW: 0.9e6,
                    onChainDirectPurchasePrice: 100
                },
                // Both checks should pass
                {
                    powerInW: 1.1e6,
                    onChainDirectPurchasePrice: 100
                }
            ];

            const numShouldMatch = 1;

            const mockedDemand: Demand.Entity = mock(Demand.Entity);
            when(mockedDemand.offChainProperties).thenReturn(testDemand);

            const demand: Demand.Entity = instance(mockedDemand);
            const certificatesToTest = [];

            for (const certificate of testCertificates) {
                const mockedCertificate: Certificate.Entity = mock(Certificate.Entity);
                when(mockedCertificate.powerInW).thenReturn(certificate.powerInW);
                when(mockedCertificate.onChainDirectPurchasePrice).thenReturn(certificate.onChainDirectPurchasePrice);

                const certificateInstance: Certificate.Entity = instance(mockedCertificate);
                certificatesToTest.push(certificateInstance);
            }

            const matchedCertificates = await findMatchingCertificatesForDemand(demand, conf, certificatesToTest);
            assert.lengthOf(matchedCertificates, numShouldMatch);
        });
    });

    describe('findMatchingSuppliesForDemand', async () => {
        it('matches only when supply power higher or equal than demand', async () => {
            const mockedDemand: Demand.Entity = mock(Demand.Entity);
            when(mockedDemand.offChainProperties).thenReturn({
                targetWhPerPeriod: 10
            });

            const mockedSupply: Supply.Entity = mock(Supply.Entity);
            when(mockedSupply.offChainProperties).thenReturn({
                availableWh: 9
            }).thenReturn({
                availableWh: 10
            }).thenReturn({
                availableWh: 11
            }).thenReturn({
                availableWh: 12
            });

            const demand: Demand.Entity = instance(mockedDemand);
            const supplies = [];

            for (let i = 0; i < 4; i++) {
                const supply: Supply.Entity = instance(mockedSupply);
                supplies.push(supply);
            }

            const matchedSupplies = await findMatchingSuppliesForDemand(demand, conf, supplies);
            assert.lengthOf(matchedSupplies, 3);
        });
    });

    // TO-DO Finish mocking this test

    // describe('findMatchingAgreementsForCertificate', async () => {
    //     it('matches when certificate assetId equals agreement supply assetId', async () => {
    //         const mockedCertificate: Certificate.Entity = mock(Certificate.Entity);
    //         when(mockedCertificate.assetId).thenReturn(0);

    //         const mockedAgreement: Agreement.Entity = mock(Agreement.Entity);
    //         when(mockedAgreement.supplyId).thenReturn(1).thenReturn(2).thenReturn(3);
            
    //         const certificate: mockedCertificate = instance(mockedCertificate);
    //         const agreements = [];

    //         for (let i = 0; i < 3; i++) {
    //             const agreement: mockedAgreement = instance(mockedAgreement);
    //             agreements.push(agreement);
    //         }

    //         console.log({
    //             certAssetId: certificate.assetId,
    //             agreementsAssetIds: agreements.map(agreement => agreement.supplyId)
    //         })

    //         const matchedAgreements = await findMatchingAgreementsForCertificate(certificate, conf, agreements);
    //         assert.lengthOf(matchedAgreements, 1);
    //     });
    // });

});