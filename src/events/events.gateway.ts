import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Chat } from 'src/lib';
import { ChatFactory } from '../chat/chat.factory';
import { SOCKET_EVENTS } from '../config';

@WebSocketGateway()
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(public readonly chatFactory: ChatFactory) {}

  @WebSocketServer()
  public server: Server;
  public usersBySocketId: object = {};
  public usersById: object = {};

  afterInit(server: Server) {

    // this.socketService.usersById = this.usersById;
  }

  handleConnection(client: Socket, ...args: any[]) {
    console.log(
      `Client connected: ${client.id} ${Object.keys(this.usersById).length} ${
        Object.keys(this.usersBySocketId).length
      }`,
    );
  }

  getUserFromId(id: string) {
    return this.usersById[id];
  }

  @SubscribeMessage(SOCKET_EVENTS.USER_LOGGED_IN)
  async findAll(@MessageBody() data: any, @ConnectedSocket() client: Socket) {

    this.usersBySocketId[client.id] = data;
    this.usersBySocketId[client.id]['socketId'] = client.id;
    this.usersById[data.id] = data;
    this.usersById[data.id]['socketId'] = client.id;
    client.emit(SOCKET_EVENTS.UPDATE_USER_NOTIFICATIONS);
    // return from([1, 2, 3]).pipe(map(item => ({ event: 'events', data: item })));
  }

  // message send
  @SubscribeMessage(SOCKET_EVENTS.MESSAGE_SENT)
  async messageSend(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {

    const message = await this.chatFactory.newMessage(data);
    // sending to individual socketid (private message)


    const user = this.getUserFromId(message.receiver.id);
    if (user && user.socketId) {


      this.server.to(user.socketId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    }
  }

  // message read
  @SubscribeMessage(SOCKET_EVENTS.READ_MESSAGE)
  async readMessage(
    @MessageBody() message: Chat,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {


    const isRead = await this.chatFactory.readAllMessages(message);
    if (isRead) {
      if (client && client.id) {
        this.server
          .to(client.id)
          .emit(SOCKET_EVENTS.MARK_MESSAGES_READ, message);
          this.server
          .to(client.id)
          .emit(SOCKET_EVENTS.UPDATE_USER_NOTIFICATIONS, {
            skip: 0
          });
      }
    }
  }

  // async sendJobNotification(data){
  //   // @ConnectedSocket() client: Socket, ): Promise<any> {
  //       return data;
  // }

  // async sendJobNotification(data: any,
  //   @ConnectedSocket() client: Socket, ): Promise<any> {
  //     console.log('-sendJobNotification call--', data);

  // }

  handleDisconnect(client: Socket) {
    console.log(
      `Client before disconnected: ${client.id} ${
        Object.keys(this.usersById).length
      } ${Object.keys(this.usersBySocketId).length}`,
    );

    if (this.usersBySocketId[client.id]) {
      const userId = this.usersBySocketId[client.id].id;
      delete this.usersBySocketId[client.id];
      delete this.usersById[userId];
      console.log(
        `Client after disconnected: ${client.id} ${
          Object.keys(this.usersById).length
        } ${Object.keys(this.usersBySocketId).length}`,
      );
    }
  }
}
