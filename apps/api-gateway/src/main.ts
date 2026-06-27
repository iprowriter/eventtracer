import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  // dev: the throwaway ui/index.html (loaded from file://) now POSTs scenario
  // actions like "redeliver" straight to the gateway, so it needs CORS.
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared on the DTO
      forbidNonWhitelisted: true, // ...and 400 if the client sent extras
      transform: true, // turn the plain JSON body into a real DTO instance
    }),
  );

  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
