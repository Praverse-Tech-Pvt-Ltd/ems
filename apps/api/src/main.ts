import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { configureApp } from './create-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Explicitly bind the Socket.IO adapter to this app's HTTP server so
  // @WebSocketGateway() classes (NotificationsGateway, ChatGateway) reliably
  // get a live `server` reference — without this it's been observed as null.
  app.useWebSocketAdapter(new IoAdapter(app));

  const bodyParser = await import('body-parser');
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

  configureApp(app);

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  console.log(`NexGen EMS API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
