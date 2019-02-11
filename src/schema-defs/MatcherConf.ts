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

export enum BlockchainDataSourceType {

    Blockchain = 'BLOCKCHAIN',
}

export enum SimulationDataSourceType {
    Simulation = 'SIMULATION',
}

export enum MatcherType {
    Simple = 'SIMPLE',
    ConfigurableReference = 'CONFIGURABLE_REFERENCE',
}

export interface BlockchainDataSource  {
    type: BlockchainDataSourceType;
    web3Url: string;
    offChainDataSourceUrl: string;
    marketContractLookupAddress: string;
    originContractLookupAddress: string;
    matcherAddress: string;

}

export interface SimulationDataSource  {
    type: SimulationDataSourceType;
    simulationFlowFile: string;
}

export interface SimulationMatcherSpecification {
    type: MatcherType;
    matcherConfigFile?: string;
}

export interface BlockchainMatcherSpecification {
    type: MatcherType;
    matcherConfigFile?: string;
}

export interface MatcherConf {
    dataSource: SimulationDataSource | BlockchainDataSource;
    matcherSpecification: SimulationMatcherSpecification | BlockchainMatcherSpecification;
}
