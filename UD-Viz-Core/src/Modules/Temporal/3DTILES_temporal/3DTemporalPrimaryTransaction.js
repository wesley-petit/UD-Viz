import { $3DTemporalTransaction } from './3DTemporalTransaction.js';

export class $3DTemporalPrimaryTransaction extends $3DTemporalTransaction {
    constructor(json) {
        super(json);

        this.type = json.type;

        this.isPrimary = true;
    }
}
