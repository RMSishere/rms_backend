import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { helpMessageSchema } from './helpMessage.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'HelpMessage', schema: helpMessageSchema }]),
    ],
    exports: [
        MongooseModule.forFeature([{ name: 'HelpMessage', schema: helpMessageSchema }]),
    ]
})

export class HelpMessageModule { }