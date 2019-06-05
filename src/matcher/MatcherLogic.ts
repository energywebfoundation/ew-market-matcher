import { Configuration } from 'ew-utils-general-lib';
import { Certificate } from 'ew-origin-lib';
import { Supply, Demand, Agreement } from 'ew-market-lib';

const findMatchingDemands = async (
    certificate: Certificate.Entity,
    conf: Configuration.Entity,
    demands?: Demand.Entity[]
): Promise<Demand.Entity[]> => {
    const certificatePower: number = Number(certificate.powerInW);

    if (!demands) {
        demands = await Demand.getAllDemands(conf);
    }

    return demands.filter(demand => {
        console.log({
            demandPerPeriod: demand.offChainProperties.targetWhPerPeriod,
            certificatePower
        });

        return demand.offChainProperties.targetWhPerPeriod >= certificatePower;
    });
};

const findMatchingSupplies = async (
    demand: Demand.Entity,
    conf: Configuration.Entity,
    supplies?: Supply.Entity[]
): Promise<Supply.Entity[]> => {
    const demandedPower: number = Number(demand.offChainProperties.targetWhPerPeriod);

    if (!supplies) {
        supplies = await Supply.getAllSupplies(conf);
    }

    return supplies.filter(supply => supply.offChainProperties.availableWh > demandedPower);
};

const findMatchingAgreements = async (
    certificate: Certificate.Entity,
    conf: Configuration.Entity,
    agreements?: Agreement.Entity[]
): Promise<Agreement.Entity[]> => {
    if (!agreements) {
        agreements =  await Agreement.getAllAgreements(conf);
    }

    return agreements.filter(async (agreement: Agreement.Entity) => {
        const supply = await new Supply.Entity(agreement.supplyId.toString(), conf).sync();

        return supply.assetId.toString() === certificate.assetId.toString();
    });
};

export {
    findMatchingDemands,
    findMatchingSupplies,
    findMatchingAgreements
};
