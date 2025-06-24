import { Base } from './base';

export class BaseDto implements Base {
    constructor(base?: Base | null) {
        if (base) {
            this._id = base._id;
            this.id = base.id;
            this.createdAt = base.createdAt;
            this.updatedAt = base.updatedAt;
            this.updatedBy = base.updatedBy;
            this.createdBy = base.createdBy;
        }
    }

    _id?: string;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
    updatedBy?: string;
    createdBy?: string;
}
