import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import bodyParser from 'body-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const scorecardDir = join(process.cwd(), 'uploads', 'scorecards');
  if (!existsSync(scorecardDir)) {
    mkdirSync(scorecardDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(
    bodyParser.json({
      limit: '5mb',
      verify: (req: any, _res: unknown, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const configService = app.get(ConfigService);
  const frontendOrigins =
    configService
      .get<string>('FRONTEND_ORIGINS')
      ?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) ?? [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser clients/tools without Origin header.
      if (!origin) return callback(null, true);
      const allowedByRegex =
        /^https?:\/\/localhost:\d+$/i.test(origin) ||
        /^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+:\d+$/i.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+:\d+$/i.test(origin);
      if (allowedByRegex || frontendOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`), false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('port') ?? 3001;

  await app.listen(port);
  Logger.log(`API http://localhost:${port}/api/v1 (e.g. POST /auth/login)`, 'Bootstrap');
}
void bootstrap();
