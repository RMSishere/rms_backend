import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ChatFactory } from './chat.factory';

@Controller('chat')
export class ChatController {
  constructor(public readonly chatFactory: ChatFactory) {}

  @Get('')
  async getMessages(@Query() params: any, @Req() req) {
    console.log('[ChatController.getMessages] params=', params, ' user=', req?.user?._id);
    const res = await this.chatFactory.getMessages(params, req.user);
    console.log('[ChatController.getMessages] done, count=', res?.count);
    return res;
  }

  @Get('/incoming')
  async getAllIncomingMessages(
    @Query() query: object,
    @Query('skip') skip: string,
    @Req() req,
  ) {
    console.log('[ChatController.getAllIncomingMessages] skip=', skip, ' query=', query, ' user=', req?.user?._id);
    const res = await this.chatFactory.getAllIncomingMessages(parseInt(skip as any), query, req.user);
    console.log('[ChatController.getAllIncomingMessages] done, count=', res?.count, ' unread=', res?.unreadCount);
    return res;
  }

  // Existing endpoint kept intact (calls getAllIncomingMessages2)
  @Post('/incomingg')
  async getAllIncomingMessagess(
    @Query() query: object,
    @Query('skip') skip: string,
    @Req() req,
  ) {
    const userId = req.body?.id;
    console.log('[ChatController.getAllIncomingMessagess] skip=', skip, ' userId=', userId, ' query=', query);
    const res = await this.chatFactory.getAllIncomingMessages2(parseInt(skip as any), query, { _id: userId });
    console.log('[ChatController.getAllIncomingMessagess] done, count=', res?.count, ' unread=', res?.unreadCount);
    return res;
  }

  // NEW endpoint -> improved sender hydration & detailed logs
  @Post('/incoming3')
  async getAllIncomingMessages3(
    @Query() query: object,
    @Query('skip') skip: string,
    @Req() req,
    @Body() body: any,
  ) {
    const userId = body?.id || req?.body?.id; // mirrors /incomingg behavior
    console.log('[ChatController.getAllIncomingMessages3] skip=', skip, ' userId=', userId, ' query=', query);
    const res = await this.chatFactory.getAllIncomingMessages3(parseInt(skip as any), query, { _id: userId });
    console.log('[ChatController.getAllIncomingMessages3] done, count=', res?.count, ' unread=', res?.unreadCount);
    return res;
  }
}
