import { Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ChatFactory } from './chat.factory';

@Controller('chat')
export class ChatController {
    constructor(public readonly chatFactory: ChatFactory) { }

    @Get('')
    async getMessages(
        @Query() params: any,
        @Req() req
    ) {
        return this.chatFactory.getMessages(params, req.user);
    }

    @Get('/incoming')
    async getAllIncomingMessages(
        @Query() query: object,
        @Query('skip') skip: string,
        @Req() req
    ) {
        return this.chatFactory.getAllIncomingMessages(parseInt(skip), query, req.user);
    }
    
@Post('/incomingg')
async getAllIncomingMessagess(
    @Query() query: object,
    @Query('skip') skip: string,
    @Req() req
) {
    const userId = req.body.id;
    return this.chatFactory.getAllIncomingMessages2(parseInt(skip), query, { _id: userId });
}

}