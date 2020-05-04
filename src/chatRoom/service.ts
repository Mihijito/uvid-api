import { Server } from "http";
import ChatRoomConnexionService, { ChatRoomConnexionServiceImpl } from './connexion/service';

interface ChatRoomService {
  openChatRoomServer(): void;
}

export class ChatRoomServiceImpl implements ChatRoomService {
  private chatRoomConnexion: ChatRoomConnexionService;

  private httpServer: Server;

  private port: string;

  constructor(httpServer: Server, port: string) {
    this.httpServer = httpServer;
    this.port = port;
    this.chatRoomConnexion = new ChatRoomConnexionServiceImpl(port, this.httpServer);
  }

  openChatRoomServer = () => {
    this.httpServer.listen(this.port)
    this.chatRoomConnexion.openConnexion();
  }
}

export default ChatRoomService;
