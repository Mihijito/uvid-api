import { createServer } from 'http';
import { ChatRoomServiceImpl } from './chatRoom';
require('dotenv').config()

const httpServer = createServer();
const chatRoomService = new ChatRoomServiceImpl(httpServer, process.env.PORT!);
chatRoomService.openChatRoomServer();