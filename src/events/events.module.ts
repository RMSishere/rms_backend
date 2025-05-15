import { Module, Global } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { ChatModule } from 'src/chat/chat.module';

@Global()
@Module({
  imports: [
    ChatModule
  ],
  providers: [
    EventsGateway,
  ],

  exports: [
    EventsGateway
  ]
})

export class EventsModule { }