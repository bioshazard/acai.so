import express from 'express';
import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import { avaChat } from './sb-langchain/agents/ava';
import axios from 'axios';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: [
      'http://192.168.4.44:5173',
      'http://localhost:5173',
      'https://www.acai.so',
    ],
    credentials: true,
  }),
);

app.get('/test', (_, res) => {
  res.send('Hello world');
});

interface AgentPayload {
  userMessage: string;
  userName: string;
  userLocation: string;
  customPrompt: string; // Replace 'any' with the actual type
  chatHistory: any; // Replace 'any' with the actual type
  currentDocument: string;
}

app.post('/v1/agent', async (req, res) => {
  try {
    const agentPayload: AgentPayload = req.body;
    const {
      userMessage,
      userName,
      userLocation,
      customPrompt,
      chatHistory,
      currentDocument,
    } = agentPayload;
    console.log('User Message:', userMessage);
    console.log('User Name:', userName);
    console.log('User Location:', userLocation);
    console.log('Custom Prompt:', customPrompt);
    console.log('Chat History:', chatHistory);
    console.log('Current Document:', currentDocument);
    res.status(200).send({ message: 'Payload received and logged' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ error: 'An error occurred while processing the payload' });
  }
});

app.get('/ava', async (req, res) => {
  const { query } = req.query as {
    query: string;
  };
  const callbacks = {
    onDataReceived: (data) => {
      io.emit('data-received', data);
    },
    onAgentAction: (data) => {
      io.emit('agent-action', data);
    },
    onProcessing: (data) => {
      io.emit('processing', data);
    },
    onError: (error) => {
      io.emit('error', error);
    },
    onCreateDocument: (data) => {
      let title = data
        .split('Title: ')[1]
        .split(', Content:')[0]
        .replace(/"/g, '');
      let content = data.split(', Content: ')[1].replace(/"/g, '');
      io.emit('create-tab', {
        title,
        content,
      });
    },
  };
  try {
    const response = await avaChat(query, callbacks);
    res.send(response);
  } catch (error) {
    console.log(error);
    io.emit('error', error.message);
    res.send('I had an issue parsing the last message, please try again');
  }
});

app.get('/proxy', async (req, res) => {
  try {
    const url = req.query.url as string;
    const response = await axios.get(url);
    res.send(response.data);
  } catch (error) {
    res.status(500).send({ error: error.toString() });
  }
});

const httpServer = createServer(app);

// create socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://192.168.4.44:5173',
      'http://localhost:5173',
      'https://www.acai.so',
    ],
  },
});

const authenticate = (socket: Socket, next: (_err?: Error) => void) => {
  const password = socket.handshake.auth.password;
  // @TODO - set to use payload authentication
  if (password === 'your_password_here') {
    console.log('Authenticated');
    return next();
  }

  next(new Error('Authentication error'));
};

io.use(authenticate);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

const start = async () => {
  httpServer.listen(3000);
};

start();
