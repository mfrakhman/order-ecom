import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.getHttpAdapter().get('/health', (_req: any, res: any) => res.status(200).json({ status: 'ok' }));
  await app.listen(process.env.PORT ?? 3003);
  logger.log(`Order-service running on port: ${process.env.PORT ?? 3003}`);
}
bootstrap();
