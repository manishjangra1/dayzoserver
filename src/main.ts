import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS for development
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 2. Enforce strict DTO validations globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // 3. Configure Swagger Interactive Developer Dashboard
  const config = new DocumentBuilder()
    .setTitle('Dayzo Social Streak Platform API')
    .setDescription('Cinematic REST API docs for managing self-improvement challenges, streaks, levels, leaderboards, and sharing cards.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 4. Start Server Listening
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Dayzo Backend running on: http://localhost:${port}`);
  console.log(`📄 Swagger Interactive API docs at: http://localhost:${port}/api/docs`);
}
bootstrap();
