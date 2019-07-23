import { Configuration } from 'ew-utils-general-lib';
import { Certificate } from 'ew-origin-lib';
import { Supply, Demand, Agreement } from 'ew-market-lib';

function certificateMatchesDemand(certificate: Certificate.Entity, demand: Demand.Entity): boolean {
    const certPricePerMwh = (certificate.onChainDirectPurchasePrice / certificate.powerInW) * 1e6;

    return demand.offChainProperties.targetWhPerPeriod <= Number(certificate.powerInW)
        && certPricePerMwh <= demand.offChainProperties.maxPricePerMwh;
}

async function findMatchingDemandsForCertificate(
    certificate: Certificate.Entity,
    conf: Configuration.Entity,
    demands?: Demand.Entity[]
): Promise<Demand.Entity[]> {
    if (!demands) {
        demands = await Demand.getAllDemands(conf);
    }

    return demands.filter(demand => certificateMatchesDemand(certificate, demand));
}

async function findMatchingCertificatesForDemand(
    demand: Demand.Entity,
    conf: Configuration.Entity,
    certs?: Certificate.Entity[]
): Promise<Certificate.Entity[]> {
    if (!certs) {
        certs = await Certificate.getActiveCertificates(conf);
    }

    return certs.filter(certificate => certificateMatchesDemand(certificate, demand));
}

async function findMatchingAgreementsForCertificate (
    certificate: Certificate.Entity,
    conf: Configuration.Entity,
    agreements?: Agreement.Entity[]
): Promise<Agreement.Entity[]> {
    if (!agreements) {
        agreements =  await Agreement.getAllAgreements(conf);
    }

    return agreements.filter(async (agreement: Agreement.Entity) => {
        const supply = await new Supply.Entity(agreement.supplyId.toString(), conf).sync();

        return supply.assetId.toString() === certificate.assetId.toString();
    });
}

async function findMatchingSuppliesForDemand(
    demand: Demand.Entity,
    conf: Configuration.Entity,
    supplies?: Supply.Entity[]
): Promise<Supply.Entity[]> {
    const demandedPower: number = Number(demand.offChainProperties.targetWhPerPeriod);

    if (!supplies) {
        supplies = await Supply.getAllSupplies(conf);
    }

    return supplies.filter(supply => supply.offChainProperties.availableWh >= demandedPower);
}

export {
    findMatchingDemandsForCertificate,
    findMatchingSuppliesForDemand,
    findMatchingAgreementsForCertificate,
    findMatchingCertificatesForDemand
};
