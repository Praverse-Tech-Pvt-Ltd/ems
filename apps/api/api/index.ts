import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express = require('express');
import { Request, Response } from 'express';
import bodyParser = require('body-parser');
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/create-app';

let cachedServer: express.Express | undefined;

async function getServer() {
  if (cachedServer) return cachedServer;

  const server = express();
  server.use(bodyParser.json({ limit: '1mb' }));
  server.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    { bodyParser: false },
  );
  configureApp(app);
  await app.init();

  cachedServer = server;
  return server;
}

export default async function handler(req: Request, res: Response) {
  const server = await getServer();
  return server(req, res);
}
