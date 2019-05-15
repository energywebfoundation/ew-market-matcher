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

import * as EwMarket from 'ew-market-lib';
import { IdentifiableEntity } from './';

export interface AgreementData extends IdentifiableEntity {
    offChainProperties: EwMarket.Agreement.AgreementOffChainProperties;
    onChainProperties: EwMarket.Agreement.AgreementOnChainProperties;
    matcherOffChainProperties: EwMarket.Agreement.MatcherOffchainProperties;
}

export interface RegisterAgreementAction {
    type: RegisterAgreementActionType;
    data: AgreementData;
}

export enum RegisterAgreementActionType {
    RegisterAgreement = 'REGISTER_AGREEMENT'
}

export const agreementDataToEntity = (agreementData: AgreementData): EwMarket.Agreement.Entity => {
    const agreement = new EwMarket.Agreement.Entity(agreementData.id, null);
    agreement.offChainProperties = agreementData.offChainProperties;
    agreement.matcherOffChainProperties = agreementData.matcherOffChainProperties;
    Object.keys(agreementData.onChainProperties).forEach(
        (key: string) => (agreement[key] = agreementData.onChainProperties[key])
    );

    return agreement;
};
