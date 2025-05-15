import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { userMiscInfoSchema } from './userMiscInfo.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'userMiscInfo', schema: userMiscInfoSchema }]),
    ],
    exports: [
        MongooseModule.forFeature([{ name: 'userMiscInfo', schema: userMiscInfoSchema }]),
    ]
})

export class UserMiscInfoModule { }