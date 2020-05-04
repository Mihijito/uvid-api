import SocketIO, { Socket } from 'socket.io';
import { Server } from 'http';
import RoomCollection from './types';

interface ChatRoomConnexionService {
  openConnexion(): void;
}

const enum ConferenceEvents {
  CONNECT = 'connection',
  DISCONNECT = 'disconnect',
  JOIN_ROOM = 'join-room',
  ROOM_ID = 'room-id',
  CALL_REQUEST = 'call-request',
  CALL_OFFER = 'callOffer',
  CREATE_ROOM = 'create-room',
  USER_DISCONNECTED = 'userDisconnected',
  USER_JOINED = 'userJoined',
  CALL_RESPONSE = 'call-response',
  CALL_ANSWER = 'callAnswer',
  INIT_USERLIST = 'initUserList',
  NEW_ICE_CANDIDATE_TRANSFER_REQUEST = 'newIceCandidateTransferRequest',
  NEW_ICE_CANDIDATE = 'newIceCandidate',
  TRACKS = 'tracks',
  BROADCAST_TRACK = 'broadcastTrack',
}

type User = {
  username: string,
  roomId: string,
}

export class ChatRoomConnexionServiceImpl implements ChatRoomConnexionService {
  private server: Server;

  private io: SocketIO.Server;

  private port: string;

  private userBySocketId: Map<string, User> = new Map<string, User>();

  private socketIdByUsername: Map<string, string> = new Map<string, string>();

  private openedRooms: RoomCollection;

  constructor(port: string, serverInstance: Server) {
    this.port = port;
    this.server = serverInstance;
    this.io = SocketIO(this.server);
    this.openedRooms = new RoomCollection();
  }

  private listen(): void {
    console.log(`Chatroom service listening on ${this.port}`);

    this.io.on(ConferenceEvents.CONNECT, (socket: Socket) => {
      socket.on(ConferenceEvents.CREATE_ROOM, (newRoom: string) => {
        const { username, roomId } = JSON.parse(newRoom);
        socket.join(roomId);

        this.registerUser(username, roomId, socket.id);
        this.openedRooms.addSocket(roomId, socket.id);

        this.updateClientUserList(socket, roomId);
      });

      socket.on(ConferenceEvents.JOIN_ROOM, (newRoom: string) => {
        const { username, roomId } = JSON.parse(newRoom);
        if (username && roomId) {
          console.log(`${username} requested connection at ${socket.id}`);

          socket.join(roomId);
          this.registerUser(username, roomId, socket.id);
          this.openedRooms.addSocket(roomId, socket.id);

          this.updateClientUserList(socket, roomId);
          socket.to(roomId).emit(ConferenceEvents.USER_JOINED, username);
        }
      });

      socket.on(ConferenceEvents.CALL_REQUEST, (requestInfos: any) => {
        const { callee, offer } = JSON.parse(requestInfos);
        console.log(callee);
        const socketId = this.socketIdByUsername.get(callee);

        console.log(`Call request received ${socketId}`);
        const callerUsername = this.userBySocketId.get(socket.id)?.username;
        if (socketId) socket.to(socketId).emit(ConferenceEvents.CALL_OFFER, JSON.stringify({ callerUsername, offer }));
      });

      socket.on(ConferenceEvents.CALL_RESPONSE, (responseInfos: string) => {
        const { callerUsername, answer } = JSON.parse(responseInfos);
        const socketId = this.socketIdByUsername.get(callerUsername);
        const calleeUsername = this.userBySocketId.get(socket.id)?.username;

        console.log(`Call response received ${socketId} from ${callerUsername}`);
        if (socketId) socket.to(socketId).emit(ConferenceEvents.CALL_ANSWER, JSON.stringify({ calleeUsername, answer }))
      });

      socket.on('disconnect-user', () => {
        console.log('Disconnect user');
        const user = this.userBySocketId.get(socket.id);
        const roomId = user?.roomId;
        this.unregisterUser(socket.id);
        socket.to(roomId!).emit(ConferenceEvents.USER_DISCONNECTED, user?.username);
      });

      socket.on(ConferenceEvents.DISCONNECT, () => {
        console.log('Disconnect user');
        const user = this.userBySocketId.get(socket.id);
        const roomId = user?.roomId;
        this.unregisterUser(socket.id);
        socket.to(roomId!).emit(ConferenceEvents.USER_DISCONNECTED, user?.username);
      });

      socket.on(ConferenceEvents.NEW_ICE_CANDIDATE_TRANSFER_REQUEST, (iceInfos: string) => {
        const { discoverer, iceCandidate } = JSON.parse(iceInfos);
        const discovererSocketId = this.socketIdByUsername.get(discoverer);
        const correspondent = this.userBySocketId.get(socket.id)?.username;
        console.log(`Ice candidate for ${correspondent} sent to ${discovererSocketId}`);
        if (discovererSocketId && correspondent) socket.to(discovererSocketId).emit(ConferenceEvents.NEW_ICE_CANDIDATE, JSON.stringify({ correspondent, iceCandidate }));
      });
    });
  }


  private updateClientUserList(socket: Socket, roomId: string) {
    const userList = this.createClientUserList(roomId);
    socket.emit(ConferenceEvents.INIT_USERLIST, userList);
  };

  private unregisterUser = (socketId: string): boolean => {
    const user: User | undefined = this.userBySocketId.get(socketId);
    if (user) {
      this.openedRooms.removeSocket(user.roomId, socketId);
      this.userBySocketId.delete(socketId);
      this.socketIdByUsername.delete(user.username);
      console.log(`${user.username} unregistered`);
      return true;
    }
    console.log('User not found');
    return false;
  };

  private registerUser = (username: string, roomId: string, socketId: string) => {
    const user: User = { username, roomId };
    this.userBySocketId.set(socketId, user);
    this.socketIdByUsername.set(user.username, socketId);
    console.log(`${user.username} registered`)
  };

  private createClientUserList = (roomId: string): string[] => {
    const connectedSockets = this.openedRooms.getRoom(roomId);

    const usernameList: string[] = connectedSockets.reduce<string[]>((usernameList, socketId: string) => {
      usernameList.push(this.userBySocketId.get(socketId)!.username)
      return usernameList;
    }, [])

    return usernameList;
  };

  public openConnexion = () => {
    this.listen();
  }
}

export default ChatRoomConnexionService;
