import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.use(cookieParser());
  app.use(compression());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const configuredOrigins = [
    process.env['FRONTEND_URL'],
    process.env['CORS_ALLOWED_ORIGINS'],
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(',').map((origin) => origin.trim()))
    .filter(Boolean);

  const explicitOrigins = [
    ...configuredOrigins,
    'https://ems.nexgenpharmasolutions.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (
        explicitOrigins.includes(origin) ||
        /^https:\/\/nexgen-ems.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('NexGen EMS API')
    .setDescription('Employee Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: unknown, res: { json: (v: unknown) => void }) => {
    res.json({ status: 'ok' });
  });
}
