import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/filters/http-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(prefix);

  // Behind the web (next rewrites) + tunnel/reverse-proxy: trust X-Forwarded-For
  // so req.ip reflects the real client (used by the login throttle). NOTE: only
  // safe when the app is actually fronted by a trusted proxy.
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set(
    'trust proxy',
    true,
  );

  // CORS for the customer web app (web/). Customer auth uses a Bearer header
  // (not cookies), so credentials are not required. Configure allowed origins
  // via CORS_ORIGINS (comma-separated); defaults cover local web dev.
  const origins = config.get<string>('CORS_ORIGINS', '');
  app.enableCors({
    origin: origins.trim()
      ? origins.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 8080);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `voucher-platform API listening on :${port}/${prefix} (env=${config.get('NODE_ENV')})`,
  );
}
bootstrap();
